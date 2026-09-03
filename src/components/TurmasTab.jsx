import { useMemo, useState } from 'react';
import { sortTurmas, EXTENSO, DIAS_ORDER } from '../domain/helpers.js';
import HoraPicker from './HoraPicker.jsx';
import Modal from './Modal.jsx';

// Aba Turmas — portada do Passarinho, adaptada ao vocabulário configurável.
export default function TurmasTab({ state, dispatch, vocab, capacidadePadrao }) {
  const sorted = useMemo(() => sortTurmas(state.turmas), [state.turmas]);
  const [expandedId, setExpandedId] = useState(null);
  const [gerenciar, setGerenciar] = useState(null); // turma sendo gerenciada

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-3">
      {sorted.length === 0 && (
        <p className="text-gray-400 text-sm italic text-center py-6">
          Nenhuma {vocab.turma} ainda. Crie a primeira abaixo.
        </p>
      )}

      {sorted.map((turma) => {
        const exp = expandedId === turma.id;
        const n = (turma.alunos || []).length;
        const cap_ = turma.capacidade || 0;
        const over = n > cap_;
        const almostFull = !over && n >= cap_ - 1;
        return (
          <div key={turma.id} className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpandedId(exp ? null : turma.id)}>
              <div>
                <div className="font-semibold text-gray-800 flex items-center gap-2">
                  {EXTENSO[turma.diaSemana] || turma.diaSemana} {turma.horario}
                  {turma.observacao && <span className="text-gray-400 font-normal text-sm">({turma.observacao})</span>}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  <span className={`font-medium ${over ? 'text-red-600' : almostFull ? 'text-amber-600' : 'text-green-600'}`}>
                    {n}/{cap_}
                  </span>
                  <span className="ml-1">{vocab.alunos}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setGerenciar(turma); }}
                  className="text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
                  Gerenciar
                </button>
                {n === 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm('Excluir esta ' + vocab.turma + '?')) dispatch({ type: 'DELETE_TURMA', id: turma.id }); }}
                    className="text-red-400 hover:text-red-600 text-sm px-2">Excluir</button>
                )}
                <span className="text-gray-400 text-lg">{exp ? '▲' : '▼'}</span>
              </div>
            </div>

            {exp && <AddAluno turma={turma} dispatch={dispatch} vocab={vocab} />}
          </div>
        );
      })}

      <NovaTurma dispatch={dispatch} vocab={vocab} existentes={state.turmas} capacidadePadrao={capacidadePadrao} />

      {gerenciar && (
        <GerenciarModal
          turma={state.turmas.find((t) => t.id === gerenciar.id) || gerenciar}
          todasTurmas={state.turmas}
          dispatch={dispatch}
          vocab={vocab}
          onClose={() => setGerenciar(null)}
        />
      )}
    </div>
  );
}

// Adição rápida de aluno (no card expandido).
function AddAluno({ turma, dispatch, vocab }) {
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState(null);
  const alunos = turma.alunos || [];

  function add() {
    const n = nome.trim();
    if (!n) return;
    if (alunos.includes(n)) { setErro(`Já existe ${vocab.aluno} "${n}" nesta ${vocab.turma}.`); return; }
    dispatch({ type: 'ADD_ALUNO', turmaId: turma.id, nome: n });
    setNome(''); setErro(null);
  }

  return (
    <div className="border-t border-gray-100 p-4 fade-in">
      <label className="block text-xs font-medium text-gray-500 mb-1">Adicionar {vocab.aluno}</label>
      <div className="flex gap-2">
        <input
          value={nome} onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder={`Nome do ${vocab.aluno}…`}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={add} disabled={!nome.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">Adicionar</button>
      </div>
      {erro && <p className="text-red-600 text-xs mt-2">{erro}</p>}

      {alunos.length === 0 ? (
        <p className="text-gray-400 text-sm italic mt-3">Nenhum {vocab.aluno} cadastrado.</p>
      ) : (
        <div className="mt-3 space-y-1">
          {alunos.map((a) => (
            <div key={a} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <span
                className="text-gray-800 cursor-pointer"
                title="Clique para renomear"
                onClick={() => { const nv = prompt(`Renomear ${a}:`, a); if (nv && nv.trim() && nv.trim() !== a) dispatch({ type: 'RENAME_ALUNO', turmaId: turma.id, oldNome: a, newNome: nv.trim() }); }}
              >{a}</span>
              <button
                onClick={() => { if (confirm(`Remover ${a}?`)) dispatch({ type: 'REMOVE_ALUNO', turmaId: turma.id, nome: a }); }}
                className="text-red-400 hover:text-red-600 text-xs px-2">remover</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Modal Gerenciar: renomear, mover de turma, remover.
function GerenciarModal({ turma, todasTurmas, dispatch, vocab, onClose }) {
  const alunos = turma.alunos || [];
  const outras = todasTurmas.filter((t) => t.id !== turma.id);

  return (
    <Modal title={`Gerenciar — ${EXTENSO[turma.diaSemana] || ''} ${turma.horario}`} onClose={onClose}>
      {alunos.length === 0 && <p className="text-gray-400 text-sm italic">Nenhum {vocab.aluno} nesta {vocab.turma}.</p>}
      <div className="space-y-2">
        {alunos.map((a) => (
          <div key={a} className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-800">{a}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { const nv = prompt(`Renomear ${a}:`, a); if (nv && nv.trim() && nv.trim() !== a) dispatch({ type: 'RENAME_ALUNO', turmaId: turma.id, oldNome: a, newNome: nv.trim() }); }}
                  className="text-xs font-medium px-2 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Renomear</button>
                <button
                  onClick={() => { if (confirm(`Remover ${a}?`)) dispatch({ type: 'REMOVE_ALUNO', turmaId: turma.id, nome: a }); }}
                  className="text-xs font-medium px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">Remover</button>
              </div>
            </div>
            {outras.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <label className="text-xs text-gray-500">Mover para:</label>
                <select
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) dispatch({ type: 'CHANGE_TURMA_ALUNO', oldTurmaId: turma.id, newTurmaId: e.target.value, nome: a }); }}
                  className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white"
                >
                  <option value="">escolher {vocab.turma}…</option>
                  {outras.map((t) => <option key={t.id} value={t.id}>{EXTENSO[t.diaSemana]} {t.horario}</option>)}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function NovaTurma({ dispatch, vocab, existentes, capacidadePadrao }) {
  const [aberto, setAberto] = useState(false);
  const [dia, setDia] = useState('segunda');
  const [hora, setHora] = useState(9);
  const [minuto, setMinuto] = useState(0);
  const [capacidade, setCapacidade] = useState(capacidadePadrao || 7);
  const [erro, setErro] = useState(null);

  function criar() {
    const hh = String(hora).padStart(2, '0');
    const mm = String(minuto).padStart(2, '0');
    const id = `${dia.slice(0, 3).replace('ç', 'c').replace('á', 'a')}-${hh}${mm}`;
    if (existentes.find((t) => t.id === id)) { setErro('Já existe uma ' + vocab.turma + ' nesse dia e horário.'); return; }
    dispatch({ type: 'ADD_TURMA', diaSemana: dia, hora, minuto, capacidade: Number(capacidade) || 7 });
    setHora(9); setMinuto(0); setCapacidade(capacidadePadrao || 7); setErro(null); setAberto(false);
  }

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="w-full bg-white rounded-xl shadow-sm border border-dashed border-gray-300 px-6 py-4 text-center font-medium text-gray-500 hover:bg-gray-50 transition-colors mt-2">
        + Nova {vocab.turma}
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mt-2 space-y-3 fade-in">
      <div className="font-semibold text-gray-800">Nova {vocab.turma}</div>
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Dia da semana</label>
          <select value={dia} onChange={(e) => setDia(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
            {DIAS_ORDER.map((d) => <option key={d} value={d}>{EXTENSO[d]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Horário (24h)</label>
          <HoraPicker hora={hora} minuto={minuto} onChange={(h, m) => { setHora(h); setMinuto(m); }} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Máx. de {vocab.alunos}</label>
          <input type="number" min="1" value={capacidade} onChange={(e) => setCapacidade(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-24" />
        </div>
      </div>
      {erro && <p className="text-red-600 text-xs">{erro}</p>}
      <div className="flex gap-2">
        <button onClick={criar} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Criar</button>
        <button onClick={() => { setAberto(false); setErro(null); }} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 text-sm">Cancelar</button>
      </div>
    </div>
  );
}
