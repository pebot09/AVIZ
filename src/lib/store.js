// Estado da escola ligado ao Firebase, por tenant.
//
// Reaproveita o modelo do Passarinho (estado da escola num nó), mas escopado a
// /tenants/{tid}/state e autenticado pelas regras. A escrita por caminho (só o
// que mudou) é uma evolução planejada; nesta fase gravamos o estado do tenant
// via SDK, que já resolve auth e realtime.
//
// Também expõe o config da escola (/tenants/{tid}/config), só-leitura aqui.

import { useEffect, useRef, useState } from 'react';
import { ref, onValue, set, get, runTransaction } from 'firebase/database';
import { db } from './firebase.js';
import { paths } from './paths.js';
import { reducer, normalizeState } from '../domain/reducer.js';

export function useConfig(tid) {
  const [config, setConfig] = useState(undefined);
  useEffect(() => {
    const r = ref(db, paths.config(tid));
    return onValue(r, (snap) => setConfig(snap.exists() ? snap.val() : {}), () => setConfig({}));
  }, [tid]);
  return config;
}

// Salva o config da escola (só o dono, pelas regras). Merge raso com o atual.
export async function saveConfig(tid, patch) {
  const snap = await get(ref(db, paths.config(tid)));
  const atual = snap.exists() ? snap.val() : {};
  await set(ref(db, paths.config(tid)), { ...atual, ...patch });
}

// Salva a vitrine pública (nome, artigo, cor).
export async function saveTenantPublic(tid, patch) {
  const snap = await get(ref(db, paths.tenantPublic(tid)));
  const atual = snap.exists() ? snap.val() : {};
  await set(ref(db, paths.tenantPublic(tid)), { ...atual, ...patch });
}

export function useTenantStore(tid, autor, config) {
  const [state, setState] = useState(undefined);
  // null = nunca carregou. Nunca começar em "vazio": como gravamos o estado
  // inteiro de uma vez, tratar "ainda não carregou" como "escola vazia" apaga
  // a escola na primeira ação.
  const stateRef = useRef(null);
  const carregadoRef = useRef(false);
  const versaoRef = useRef(0); // _updatedAt do que temos em mãos
  const configRef = useRef(config);
  configRef.current = config;
  const [erro, setErro] = useState(null);

  // Aplica a verdade do servidor no estado local (usado no load e ao
  // reconciliar depois de uma gravação que não confirmou).
  function aplicarServidor(raw) {
    const s = normalizeState(raw);
    versaoRef.current = Number(raw && raw._updatedAt) || 0;
    stateRef.current = s;
    carregadoRef.current = true;
    setState(s);
  }

  useEffect(() => {
    carregadoRef.current = false;
    stateRef.current = null;
    versaoRef.current = 0;
    setState(undefined);

    const r = ref(db, paths.state(tid));
    return onValue(
      r,
      (snap) => {
        const raw = snap.val();
        // Sumiço: já tínhamos dados e agora vem vazio. Isso não é "a escola
        // ficou vazia" — é perda de acesso (saiu da conta, token expirou,
        // regras). Não adotamos esse vazio (mostraria a escola zerada).
        if (raw == null && carregadoRef.current && versaoRef.current > 0) {
          setErro('Perdemos o acesso aos dados desta escola. Recarregue a página e entre de novo — nada foi alterado.');
          return;
        }
        aplicarServidor(raw);
        setErro(null);
      },
      (e) => setErro(e.message),
    );
  }, [tid]);

  function dispatch(action) {
    // Sem ter carregado ainda não dá para agir com segurança.
    if (!carregadoRef.current) {
      setErro('Os dados ainda estão carregando. Tente de novo em um instante.');
      return;
    }
    const acaoCompleta = { ...action, autor };

    // 1) UI otimista: aplica já sobre o que temos, para a tela responder na
    // hora. Não é o que persiste — só o que o usuário vê enquanto grava.
    const atual = stateRef.current;
    const previa = reducer(atual, acaoCompleta, configRef.current);
    if (previa === atual) return; // ação sem efeito
    stateRef.current = previa;
    setState(previa);
    setErro(null);

    // 2) Gravação autoritativa: aplica o reducer DENTRO da transação, sobre o
    // valor mais recente do servidor. Assim duas abas/dispositivos editando ao
    // mesmo tempo se SOMAM (cada ação parte do estado já gravado pela outra),
    // em vez de uma sobrescrever ou ser descartada em silêncio.
    (async () => {
      try {
        // Puxa a verdade do servidor para o cache antes da transação, para que
        // ela não rode a primeira vez contra um cache vazio e conclua "nada
        // mudou" por engano (era assim que uma gravação legítima sumia).
        await get(ref(db, paths.state(tid)));
        const res = await runTransaction(ref(db, paths.state(tid)), (servidor) => {
          const base = normalizeState(servidor);
          const next = reducer(base, acaoCompleta, configRef.current);
          if (next === base) return undefined; // no-op real → aborta sem erro
          return { ...next, _updatedAt: Date.now() };
        });
        if (!res.committed) {
          // Não confirmou (no-op contra o servidor): re-sincroniza com a verdade
          // para a tela não ficar mostrando algo que não foi salvo. No caminho
          // de sucesso não fazemos nada — o listener onValue já reconcilia com o
          // valor gravado (evita piscar a tela em gravações rápidas seguidas).
          const snap = await get(ref(db, paths.state(tid)));
          aplicarServidor(snap.val());
        }
      } catch (e) {
        // Falha real (sem acesso, rede, regras): avisa ALTO e volta para a
        // verdade do servidor — nunca deixa a tela fingir que salvou.
        setErro('Não consegui salvar. Recarregue a página para conferir o que está salvo antes de refazer. (' + (e.message || 'erro') + ')');
        try { const snap = await get(ref(db, paths.state(tid))); aplicarServidor(snap.val()); } catch { /* mantém o aviso */ }
      }
    })();
  }

  return { state, dispatch, erro };
}
