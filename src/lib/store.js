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
        // regras). Adotar esse vazio mostraria a escola zerada e, na primeira
        // ação, gravaria o zero por cima de tudo.
        if (raw == null && carregadoRef.current) {
          setErro('Perdemos o acesso aos dados desta escola. Recarregue a página e entre de novo — nada foi alterado.');
          return;
        }
        const s = normalizeState(raw);
        versaoRef.current = Number(raw && raw._updatedAt) || 0;
        stateRef.current = s;
        carregadoRef.current = true;
        setState(s);
        setErro(null);
      },
      (e) => setErro(e.message),
    );
  }, [tid]);

  function dispatch(action) {
    // Sem dados carregados não se grava: seria escrever vazio sobre a escola.
    if (!carregadoRef.current || !stateRef.current) {
      setErro('Os dados ainda estão carregando. Tente de novo em um instante.');
      return;
    }
    const atual = stateRef.current;
    const next = reducer(atual, { ...action, autor }, configRef.current);
    if (next === atual) return;

    const base = versaoRef.current;
    const versao = Date.now();
    stateRef.current = next;
    versaoRef.current = versao;
    setState(next); // otimista

    // Gravação condicional: se o servidor já está numa versão mais nova que a
    // que usamos de base, aborta em vez de sobrescrever o trabalho de outro
    // dispositivo. (O Passarinho conferia isso na mão; aqui é transação.)
    runTransaction(ref(db, paths.state(tid)), (servidor) => {
      const versaoServidor = Number(servidor && servidor._updatedAt) || 0;
      if (versaoServidor > base) return undefined; // aborta; o listener traz o mais novo
      return { ...next, _updatedAt: versao };
    })
      .then((res) => {
        if (!res.committed) {
          setErro('Esta escola foi alterada em outro lugar ao mesmo tempo. Trouxemos a versão mais recente — confira e refaça se precisar.');
        }
      })
      .catch((e) => setErro(e.message));
  }

  return { state, dispatch, erro };
}
