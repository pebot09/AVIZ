import { useEffect, useRef, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../lib/firebase.js';
import { paths } from '../lib/paths.js';
import { useTenantStore, useConfig } from '../lib/store.js';
import { makeVocab, cap } from '../domain/vocab.js';
import { logout } from '../lib/auth.js';
import TurmasTab from './TurmasTab.jsx';
import FaltasReposicoesTab from './FaltasReposicoesTab.jsx';
import ConfigScreen from './ConfigScreen.jsx';

// Painel da escola (dono/professor autenticado). Estrutura das abas espelha o
// Passarinho: Turmas · Faltas & Reposições · Painel. Por ora, Turmas está
// portada; as outras entram nas próximas fatias.

const ABAS = ['Turmas', 'Faltas & Reposições', 'Painel'];

export default function EscolaApp({ tenant, user, membro }) {
  const config = useConfig(tenant);
  // Autor do log = nome do membro (não o e-mail), para o histórico ficar limpo.
  const { state, dispatch, erro } = useTenantStore(tenant, (membro && membro.nome) || user.email, config);
  const [pub, setPub] = useState(null);
  const [aba, setAba] = useState('Turmas');
  const [configAberto, setConfigAberto] = useState(false);

  useEffect(() => onValue(ref(db, paths.tenantPublic(tenant)), (snap) => setPub(snap.val() || {})), [tenant]);
  const nomeEscola = (pub && pub.nome) || tenant;

  const vocab = makeVocab(config);
  const carregando = state === undefined || config === undefined;

  // Uma vez, após carregar, recalcula as vagas extras (como o Passarinho faz no sync).
  const cleanupFeito = useRef(false);
  useEffect(() => {
    if (!carregando && !cleanupFeito.current) { cleanupFeito.current = true; dispatch({ type: 'CLEANUP' }); }
  }, [carregando]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-gray-100 min-h-screen">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 pt-3 pb-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] tracking-[0.2em] text-gray-300 font-semibold">AVIZ</div>
              <h1 className="text-2xl font-bold text-gray-800 leading-tight">{nomeEscola}</h1>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <button onClick={() => setConfigAberto(true)} className="text-gray-400 hover:text-gray-600 text-lg" title="Configurações">⚙</button>
              <button onClick={() => logout()} className="text-gray-400 hover:text-gray-600 text-sm underline">sair</button>
            </div>
          </div>
          <nav className="flex gap-1 mt-3 -mb-px">
            {ABAS.map((a) => (
              <button
                key={a} onClick={() => setAba(a)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  aba === a ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >{a}</button>
            ))}
          </nav>
        </div>
      </header>

      {erro && <p className="max-w-4xl mx-auto px-4 pt-3 text-red-600 text-sm">{erro}</p>}

      {carregando ? (
        <p className="text-center text-gray-400 text-sm py-10">Carregando…</p>
      ) : aba === 'Turmas' ? (
        <TurmasTab state={state} dispatch={dispatch} vocab={vocab} config={config} capacidadePadrao={(config?.regras?.capacidadeNominal) || 7} />
      ) : aba === 'Faltas & Reposições' ? (
        <FaltasReposicoesTab state={state} dispatch={dispatch} vocab={vocab} config={config} />
      ) : (
        <EmBreve nome={aba} />
      )}

      {configAberto && <ConfigScreen tenant={tenant} config={config} pub={pub} dispatch={dispatch} onClose={() => setConfigAberto(false)} />}
    </div>
  );
}

function EmBreve({ nome }) {
  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500 font-medium">{nome}</p>
        <p className="text-gray-400 text-sm mt-1">Em construção — próxima fatia do porte.</p>
      </div>
    </div>
  );
}
