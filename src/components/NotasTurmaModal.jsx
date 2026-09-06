import { useEffect, useState } from 'react';
import { arr, turmaShortLabel, markNotasSeen, corDoAutor, TURMA_EXTRA_ID } from '../domain/helpers.js';
import Modal from './Modal.jsx';

// Notas da turma — recado entre quem dá aula. Porte do NotasTurmaModal do
// Passarinho, com cor de autor determinística no lugar da paleta fixa.
export default function NotasTurmaModal({ turma, state, dispatch, tenantId, autor, onClose }) {
  const [texto, setTexto] = useState('');
  const [editando, setEditando] = useState(false);
  const notas = arr(state.notas).filter((n) => n.turmaId === turma.id).sort((a, b) => b.ts.localeCompare(a.ts));
  const titulo = turma.id === TURMA_EXTRA_ID ? 'Extra' : turmaShortLabel(turma);

  // Abrir as notas = tê-las visto (some o marcador vermelho no card).
  useEffect(() => { markNotasSeen(tenantId, turma.id); }, [tenantId, turma.id, notas.length]);

  const adicionar = () => {
    if (!texto.trim()) return;
    dispatch({ type: 'ADD_NOTA', turmaId: turma.id, texto: texto.trim() });
    setTexto('');
  };

  return (
    <Modal title={`📋 Notas — ${titulo}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') adicionar(); }}
            placeholder="Escrever nota…"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            autoFocus
          />
          <button onClick={adicionar} disabled={!texto.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">Salvar</button>
        </div>

        {notas.length > 0 && (
          <div className="flex justify-end">
            <button onClick={() => setEditando((e) => !e)} className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${editando ? 'bg-red-50 border-red-300 text-red-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {editando ? '✓ Concluir' : '✏️ Editar'}
            </button>
          </div>
        )}

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {notas.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nenhuma nota ainda.</p>}
          {notas.map((n) => {
            const dt = new Date(n.ts);
            const quando = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const c = corDoAutor(n.autor);
            return (
              <div key={n.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
                    {n.autor || '—'}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-400">{quando}</span>
                    {editando && (
                      <button onClick={() => dispatch({ type: 'DELETE_NOTA', id: n.id })}
                        className="text-red-400 hover:text-white hover:bg-red-500 border border-red-200 hover:border-red-500 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
                        title="Apagar nota">✕</button>
                    )}
                  </div>
                </div>
                <p className="text-gray-800 whitespace-pre-wrap break-words">{n.texto}</p>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
