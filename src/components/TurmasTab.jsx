import { useMemo, useState } from 'react';
import { sortTurmas, turmaShortLabel, DIAS_ORDER, EXTENSO } from '../domain/helpers.js';
import { cap } from '../domain/vocab.js';

// Aba Turmas — portada do Passarinho, adaptada ao vocabulário configurável.
export default function TurmasTab({ state, dispatch, vocab }) {
  const sorted = useMemo(() => sortTurmas(state.turmas), [state.turmas]);
  const [expandedId, setExpandedId] = useState(null);

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
                {n === 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm('Excluir esta ' + vocab.turma + '?')) dispatch({ type: 'DELETE_TURMA', id: turma.id }); }}
                    className="text-red-400 hover:text-red-600 text-sm px-2">Excluir</button>
                )}
                <span className="text-gray-400 text-lg">{exp ? '▲' : '▼'}</span>
              </div>
            </div>

            {exp && <GerenciarTurma turma={turma} state={state} dispatch={dispatch} vocab={vocab} />}
          </div>
        );
      })}

      <NovaTurma dispatch={dispatch} vocab={vocab} existentes={state.turmas} />
    </div>
  );
}

function GerenciarTurma({ turma, dispatch, vocab }) {
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
      <div className="flex gap-2 mb-3">
        <input
          value={nome} onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder={`Adicionar ${vocab.aluno}…`}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={add} disabled={!nome.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">Adicionar</button>
      </div>
      {erro && <p className="text-red-600 text-xs mb-2">{erro}</p>}

      {alunos.length === 0 && <p className="text-gray-400 text-sm italic">Nenhum {vocab.aluno} cadastrado.</p>}
      <div className="space-y-1">
        {alunos.map((a) => (
          <div key={a} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
            <span
              className="text-gray-800 cursor-pointer"
              onClick={() => {
                const nv = prompt(`Renomear ${a}:`, a);
                if (nv && nv.trim() && nv.trim() !== a) dispatch({ type: 'RENAME_ALUNO', turmaId: turma.id, oldNome: a, newNome: nv.trim() });
              }}
              title="Clique para renomear"
            >{a}</span>
            <button
              onClick={() => { if (confirm(`Remover ${a}?`)) dispatch({ type: 'REMOVE_ALUNO', turmaId: turma.id, nome: a }); }}
              className="text-red-400 hover:text-red-600 text-xs px-2">remover</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function NovaTurma({ dispatch, vocab, existentes }) {
  const [aberto, setAberto] = useState(false);
  const [dia, setDia] = useState('segunda');
  const [horario, setHorario] = useState('');
  const [capacidade, setCapacidade] = useState(7);
  const [erro, setErro] = useState(null);

  function criar() {
    const h = horario.trim();
    if (!h) { setErro('Informe o horário.'); return; }
    const id = `${dia.slice(0, 3).replace('ç', 'c').replace('á', 'a')}-${h}`;
    if (existentes.find((t) => t.id === id)) { setErro('Já existe uma ' + vocab.turma + ' nesse dia e horário.'); return; }
    dispatch({ type: 'ADD_TURMA', diaSemana: dia, horario: h, capacidade: Number(capacidade) || 7 });
    setHorario(''); setCapacidade(7); setErro(null); setAberto(false);
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <select value={dia} onChange={(e) => setDia(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {DIAS_ORDER.map((d) => <option key={d} value={d}>{EXTENSO[d]}</option>)}
        </select>
        <input value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="Horário (ex.: 09h ou 19h30)" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <input type="number" min="1" value={capacidade} onChange={(e) => setCapacidade(e.target.value)} placeholder={`Máx. ${vocab.alunos}`} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      {erro && <p className="text-red-600 text-xs">{erro}</p>}
      <div className="flex gap-2">
        <button onClick={criar} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Criar</button>
        <button onClick={() => { setAberto(false); setErro(null); }} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 text-sm">Cancelar</button>
      </div>
    </div>
  );
}
