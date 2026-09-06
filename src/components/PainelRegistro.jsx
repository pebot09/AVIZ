import { useMemo, useState } from 'react';
import { arr, corDoAutor, getTurmaLabel } from '../domain/helpers.js';
import Modal from './Modal.jsx';
import HistoricoAluno from './HistoricoAluno.jsx';

// Registro (log) — porte do PainelRegistro do Passarinho.
// Diferença do original: apagar registro era "só o Pedro, no desktop". Aqui é
// permissão de verdade — só quem é dono da escola.
export default function PainelRegistro({ state, dispatch, podeEditar }) {
  const log = arr(state.log);
  const [editando, setEditando] = useState(false);
  const [historico, setHistorico] = useState(null); // { nome, turmaId }

  // Nomes de alunos: do maior para o menor, para casar o nome mais específico
  // primeiro quando um nome é prefixo de outro.
  const nomesAlunos = useMemo(
    () => [...new Set(arr(state.turmas).flatMap((t) => arr(t.alunos)))].sort((a, b) => b.length - a.length),
    [state.turmas],
  );

  // Turmas do aluno = roster atual + origem de faltas/reposições (cobre ex-aluno
  // fora do roster). Desambigua pelo rótulo embutido na descrição, para
  // homônimos em turmas diferentes irem ao histórico certo.
  const abrirHistorico = (nome, descricao) => {
    const ids = new Set();
    arr(state.turmas).forEach((t) => { if (arr(t.alunos).includes(nome)) ids.add(t.id); });
    arr(state.faltas).forEach((f) => { if (f.alunoNome === nome) ids.add(f.turmaId); });
    arr(state.reposicoes).forEach((r) => { if (r.alunoNome === nome && r.turmaOrigemId) ids.add(r.turmaOrigemId); });
    const doAluno = [...ids];
    const casada = doAluno.find((id) => descricao.includes(getTurmaLabel(state.turmas, id)));
    setHistorico({ nome, turmaId: casada || (doAluno.length === 1 ? doAluno[0] : null) });
  };

  if (log.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">Nenhuma ação registrada ainda.</p>;
  }

  return (
    <div>
      {historico && (
        <Modal title={`Histórico — ${historico.nome}`} onClose={() => setHistorico(null)}>
          <HistoricoAluno alunoNome={historico.nome} turmaId={historico.turmaId} state={state} />
        </Modal>
      )}

      {podeEditar && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setEditando((e) => !e)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${editando ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >{editando ? '✓ Concluir' : '✏️ Editar'}</button>
        </div>
      )}

      <div className="space-y-2">
        {log.map((entry) => {
          const doAluno = entry.origem === 'aluno';
          const c = doAluno ? { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' } : corDoAutor(entry.professor);
          const dt = new Date(entry.ts);
          const quando = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const ehAluno = nomesAlunos.includes(entry.professor);
          const chip = (
            <>
              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
              {entry.professor || '—'}
            </>
          );
          return (
            <div key={entry.id} className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
              {editando && (
                <button
                  onClick={() => dispatch({ type: 'DELETE_LOG_ENTRY', id: entry.id })}
                  className="text-red-400 hover:text-white hover:bg-red-500 border border-red-200 hover:border-red-500 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-colors"
                  title="Apagar este registro"
                >✕</button>
              )}
              {ehAluno ? (
                <button onClick={() => abrirHistorico(entry.professor, entry.descricao || '')}
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5 shrink-0 ${c.bg} ${c.text} hover:opacity-75`}>
                  {chip}
                </button>
              ) : (
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5 shrink-0 ${c.bg} ${c.text}`}>
                  {chip}
                </span>
              )}
              <div className="flex-1 min-w-0">
                {/* Ano fora: o registro é sempre recente, e a data curta cabe melhor. */}
                <p className="text-sm text-gray-800 break-words">{(entry.descricao || '').replace(/\b(\d{2})\/(\d{2})\/20\d{2}\b/g, '$1/$2')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{quando}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
