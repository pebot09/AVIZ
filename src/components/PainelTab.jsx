import { useState } from 'react';
import PainelVisual from './PainelVisual.jsx';
import PainelRegistro from './PainelRegistro.jsx';
import ResumoDia from './ResumoDia.jsx';
import SnapshotsModal from './Snapshots.jsx';

// Aba Painel — porte do SectionPainel do Passarinho.
// Fora do original: os botões de "copiar lista", "copiar vagas para o WhatsApp"
// e "ver texto bruto" saíram (o painel do aluno e o aviso de vaga substituem o
// fluxo de mandar texto na mão). O histórico de fotos da lista saiu da barra de
// abas para um botão discreto no cabeçalho, e é mostrado formatado.
export default function PainelTab({ state, dispatch, vocab, config, podeEditarLog }) {
  const [aba, setAba] = useState(0);
  const [verResumo, setVerResumo] = useState(false);
  const [verSnapshots, setVerSnapshots] = useState(false);
  const abas = ['Lista atual', 'Registro'];

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-3">
      <div className="flex justify-between items-center mb-1 gap-2">
        <h2 className="text-xl font-bold text-gray-800">Painel</h2>
        <button onClick={() => setVerSnapshots(true)}
          className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 transition-colors"
          title="Fotos da lista">🕘 Fotos</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {abas.map((t, i) => (
            <button key={t} onClick={() => setAba(i)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${aba === i ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="p-4">
          {aba === 0 && <PainelVisual state={state} dispatch={dispatch} vocab={vocab} config={config} />}
          {aba === 1 && <PainelRegistro state={state} dispatch={dispatch} podeEditar={podeEditarLog} />}
        </div>
      </div>

      <button
        onClick={() => setVerResumo((r) => !r)}
        className="w-full bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-5 text-center font-bold text-gray-800 text-base tracking-widest hover:bg-gray-50 active:bg-gray-100 transition-colors"
      >
        {verResumo ? '▲' : '▼'} RESUMO DO DIA
      </button>
      {verResumo && <ResumoDia state={state} vocab={vocab} config={config} />}

      {verSnapshots && (
        <SnapshotsModal state={state} dispatch={dispatch} config={config} vocab={vocab} onClose={() => setVerSnapshots(false)} />
      )}
    </div>
  );
}
