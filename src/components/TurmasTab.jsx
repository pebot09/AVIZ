import { Fragment, useMemo, useState } from 'react';
import {
  sortTurmas, EXTENSO, DIAS_ORDER, TURMA_EXTRA_ID, arr,
  turmaShortLabel, getTurmaLabel, todayStr, dateToStr, getFaltaExpiry,
} from '../domain/helpers.js';
import { cap } from '../domain/vocab.js';
import HoraPicker from './HoraPicker.jsx';
import Modal from './Modal.jsx';
import HistoricoAluno from './HistoricoAluno.jsx';

// Aba Turmas — porte fiel do SectionTurmas do Passarinho, com vocabulário
// configurável e o seletor de horário 24h do AVIZ.
export default function TurmasTab({ state, dispatch, vocab, capacidadePadrao }) {
  const sorted = useMemo(() => sortTurmas(state.turmas).filter((t) => t.id !== TURMA_EXTRA_ID), [state.turmas]);
  const [expandedId, setExpandedId] = useState(null);
  const [gerenciando, setGerenciando] = useState(null);
  const [showNova, setShowNova] = useState(false);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-3">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-gray-800">{cap(vocab.turmas)}</h2>
        <button onClick={() => setShowNova(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">+ Nova {vocab.turma}</button>
      </div>

      {sorted.length === 0 && (
        <p className="text-gray-400 text-sm italic text-center py-6">Nenhuma {vocab.turma} ainda.</p>
      )}

      {sorted.map((turma) => (
        <TurmaCard
          key={turma.id} turma={turma} state={state} dispatch={dispatch} vocab={vocab}
          exp={expandedId === turma.id}
          onToggle={() => setExpandedId(expandedId === turma.id ? null : turma.id)}
          onGerenciar={() => setGerenciando(turma)}
        />
      ))}

      {showNova && (
        <NovaTurmaModal dispatch={dispatch} vocab={vocab} existentes={state.turmas} capacidadePadrao={capacidadePadrao} onClose={() => setShowNova(false)} />
      )}
      {gerenciando && (
        <GerenciarAlunoModal
          turma={state.turmas.find((t) => t.id === gerenciando.id) || gerenciando}
          state={state} dispatch={dispatch} vocab={vocab} onClose={() => setGerenciando(null)}
        />
      )}
    </div>
  );
}

function TurmaCard({ turma, state, dispatch, vocab, exp, onToggle, onGerenciar }) {
  const td = todayStr();
  const in7 = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 7); return dateToStr(d); }, []);
  const [editObs, setEditObs] = useState(undefined);
  const [addingAluno, setAddingAluno] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [erro, setErro] = useState(null);
  const [historico, setHistorico] = useState({}); // nome -> bool
  const [legenda, setLegenda] = useState(false);

  const n = (turma.alunos || []).length;
  const over = n > turma.capacidade;
  const almostFull = !over && n >= turma.capacidade - 1;

  function tryAdd() {
    const nome = novoNome.trim();
    if (!nome) return;
    if ((turma.alunos || []).includes(nome)) { setErro(`Já existe ${vocab.aluno} "${nome}" nesta ${vocab.turma}. Use um nome diferente.`); return; }
    dispatch({ type: 'ADD_ALUNO', turmaId: turma.id, nome });
    setNovoNome(''); setErro(null); setAddingAluno(false);
  }

  const cell = (num, cor) => <span className={`text-center text-xs py-1.5 ${num ? cor : 'text-gray-300'}`}>{num || '·'}</span>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between p-4 cursor-pointer" onClick={onToggle}>
        <div>
          <div className="font-semibold text-gray-800 flex items-center gap-2">
            {EXTENSO[turma.diaSemana] || turma.diaSemana} {turma.horario}
            {turma.observacao && <span className="text-gray-400 font-normal text-sm">({turma.observacao})</span>}
          </div>
          <div className="text-sm text-gray-500 mt-0.5">
            <span className={`font-medium ${over ? 'text-red-600' : almostFull ? 'text-amber-600' : 'text-green-600'}`}>{n}/{turma.capacidade}</span>
            <span className="ml-1">{vocab.alunos}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); onGerenciar(); }} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">Gerenciar</button>
          {n === 0 && <button onClick={(e) => { e.stopPropagation(); if (confirm('Excluir esta ' + vocab.turma + '?')) dispatch({ type: 'DELETE_TURMA', id: turma.id }); }} className="text-red-400 hover:text-red-600 text-sm px-2">Excluir</button>}
          <span className="text-gray-400 text-lg">{exp ? '▲' : '▼'}</span>
        </div>
      </div>

      {exp && (
        <div className="border-t border-gray-100 p-4 fade-in">
          <div className="mb-3 flex gap-2">
            <input
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              placeholder="Observação (ex: com Bia)"
              value={editObs !== undefined ? editObs : (turma.observacao || '')}
              onChange={(e) => setEditObs(e.target.value)}
            />
            <button onClick={() => { dispatch({ type: 'UPDATE_TURMA', id: turma.id, observacao: editObs ?? turma.observacao }); setEditObs(undefined); }} className="px-3 py-1.5 bg-gray-200 rounded-lg text-sm hover:bg-gray-300">Salvar</button>
          </div>

          <div className="space-y-1 mb-3">
            {n === 0 && <p className="text-gray-400 text-sm italic">Nenhum {vocab.aluno} cadastrado</p>}
            {n > 0 && (
              <div className="grid items-center gap-x-2 px-2" style={{ gridTemplateColumns: 'max-content repeat(4, minmax(0,1fr)) max-content' }}>
                <span></span>
                <span className="text-center text-sm py-1" title="Faltas ativas">✋</span>
                <span className="text-center text-sm py-1" title="Reposições agendadas">🔄</span>
                <span className="text-center text-sm py-1" title="Créditos extras">🎟️</span>
                <span className="text-center text-sm py-1" title="Créditos de férias">🏖️</span>
                <button onClick={() => setLegenda((v) => !v)} className="justify-self-end text-gray-400 hover:text-gray-600 text-sm px-1 py-1" title="Legenda">ⓘ</button>
                {legenda && (
                  <div style={{ gridColumn: '1 / -1' }} className="mb-2 bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-600 space-y-0.5 fade-in">
                    <div>✋ Faltas ativas (a marcar + já com reposição)</div>
                    <div>🔄 Reposições agendadas (ainda não realizadas)</div>
                    <div>🎟️ Créditos extras disponíveis</div>
                    <div>🏖️ Créditos de férias disponíveis</div>
                  </div>
                )}
                {[...turma.alunos].sort((a, b) => a.localeCompare(b, 'pt')).map((nome) => {
                  const hOpen = !!historico[nome];
                  const nFaltas = arr(state.faltas).filter((f) => f.turmaId === turma.id && f.alunoNome === nome && (f.status === 'pendente' || f.status === 'marcada')).length;
                  const nRepos = arr(state.reposicoes).filter((r) => r.turmaOrigemId === turma.id && r.alunoNome === nome && !r.realizada).length;
                  const nFerias = arr(state.ausencias).filter((a) => a.turmaId === turma.id && a.alunoNome === nome && !a.creditoUsado && a.creditoReposicao > 0).length;
                  const nExtra = arr(state.creditos).filter((c) => c.turmaId === turma.id && c.alunoNome === nome && !c.usado && c.dataExpiracao >= td).length;
                  const faltaExpirando = arr(state.faltas).some((f) => f.turmaId === turma.id && f.alunoNome === nome && f.status === 'pendente' && getFaltaExpiry(f) >= td && getFaltaExpiry(f) <= in7);
                  return (
                    <Fragment key={nome}>
                      <span className="text-sm text-gray-700 py-1.5 pr-2 whitespace-nowrap">{nome}</span>
                      {cell(nFaltas, faltaExpirando ? 'text-red-600 font-bold' : 'text-amber-600 font-medium')}
                      {cell(nRepos, 'text-blue-600 font-medium')}
                      {cell(nExtra, 'text-purple-600 font-medium')}
                      {cell(nFerias, 'text-teal-600 font-medium')}
                      <button
                        onClick={() => setHistorico((h) => ({ ...h, [nome]: !h[nome] }))}
                        className={`justify-self-end text-xs px-2 py-0.5 rounded-full border transition-colors ${hOpen ? 'bg-gray-200 border-gray-300 text-gray-700' : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'}`}
                        title="Ver histórico"
                      >📋</button>
                      {hOpen && (
                        <div style={{ gridColumn: '1 / -1' }} className="px-1 pb-2 pt-1 border-t border-gray-100 fade-in">
                          <HistoricoAluno alunoNome={nome} turmaId={turma.id} state={state} />
                        </div>
                      )}
                    </Fragment>
                  );
                })}
              </div>
            )}
          </div>

          {addingAluno ? (
            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                placeholder={`Nome do ${vocab.aluno}`} value={novoNome}
                onChange={(e) => { setNovoNome(e.target.value); if (erro) setErro(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') tryAdd(); if (e.key === 'Escape') { setAddingAluno(false); setErro(null); } }}
                autoFocus
              />
              <button onClick={tryAdd} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">OK</button>
              <button onClick={() => { setAddingAluno(false); setErro(null); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">✕</button>
            </div>
          ) : (
            <button onClick={() => setAddingAluno(true)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Adicionar {vocab.aluno}</button>
          )}
          {erro && <p className="text-xs text-red-500 mt-1">{erro}</p>}
        </div>
      )}
    </div>
  );
}

// Gerenciar alunos — porte fiel do GerenciarAlunoModal (renomear, mover, remover).
function GerenciarAlunoModal({ turma, state, dispatch, vocab, onClose }) {
  const td = todayStr();
  const [expanded, setExpanded] = useState(null);
  const [renames, setRenames] = useState({});
  const [confirmRemove, setConfirmRemove] = useState(null);
  const outras = useMemo(() => sortTurmas(state.turmas).filter((t) => t.id !== turma.id), [state.turmas, turma.id]);
  const sorted = useMemo(() => [...(turma.alunos || [])].sort((a, b) => a.localeCompare(b, 'pt')), [turma.alunos]);

  const canChange = (nome, destinoId) => {
    const destino = state.turmas.find((t) => t.id === destinoId);
    if (destino && arr(destino.alunos).includes(nome)) return { can: false, reason: `já há ${vocab.aluno} "${nome}" nessa ${vocab.turma}` };
    if (destinoId === TURMA_EXTRA_ID) return { can: true };
    if (arr(state.faltas).some((f) => f.turmaId === turma.id && f.alunoNome === nome && arr(f.datas).some((d) => d >= td))) return { can: false, reason: 'tem faltas futuras' };
    if (arr(state.ausencias).some((a) => a.turmaId === turma.id && a.alunoNome === nome && a.mesAno >= td.slice(0, 7))) return { can: false, reason: 'tem férias futuras' };
    return { can: true };
  };
  const hasPendencies = (nome) =>
    arr(state.faltas).some((f) => f.turmaId === turma.id && f.alunoNome === nome && f.status === 'pendente') ||
    arr(state.reposicoes).some((r) => r.turmaOrigemId === turma.id && r.alunoNome === nome && !r.realizada);
  const handleRename = (oldNome) => {
    const nn = (renames[oldNome] ?? oldNome).trim();
    if (nn && nn !== oldNome) dispatch({ type: 'RENAME_ALUNO', turmaId: turma.id, oldNome, newNome: nn });
  };

  return (
    <Modal title={`Gerenciar ${vocab.alunos} — ${turmaShortLabel(turma)}`} onClose={onClose}>
      {confirmRemove && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm space-y-2">
          <p className="text-red-700 font-medium">Remover <strong>{confirmRemove}</strong> da {vocab.turma}?</p>
          {hasPendencies(confirmRemove) && <p className="text-red-500 text-xs">⚠️ Tem faltas ou reposições pendentes.</p>}
          <div className="flex gap-2">
            <button onClick={() => { dispatch({ type: 'REMOVE_ALUNO', turmaId: turma.id, nome: confirmRemove }); onClose(); }} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700">Confirmar</button>
            <button onClick={() => setConfirmRemove(null)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs">Cancelar</button>
          </div>
        </div>
      )}
      <div className="space-y-1">
        {sorted.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nenhum {vocab.aluno} nesta {vocab.turma}.</p>}
        {sorted.map((nome) => {
          const isOpen = expanded === nome;
          const renameVal = renames[nome] !== undefined ? renames[nome] : nome;
          return (
            <div key={nome} className="border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setExpanded(isOpen ? null : nome)} className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                <span className="text-sm font-medium text-gray-800">{nome}</span>
                <span className="text-gray-400 text-xs ml-2">{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 pt-2 bg-white space-y-2 border-t border-gray-100">
                  <div className="flex gap-2 items-center">
                    <input
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" value={renameVal}
                      onChange={(e) => setRenames((r) => ({ ...r, [nome]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { handleRename(nome); onClose(); } }}
                      placeholder="Renomear…"
                    />
                    {renameVal.trim() !== nome && renameVal.trim() !== '' && (
                      <button onClick={() => { handleRename(nome); onClose(); }} className="text-xs px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shrink-0">Salvar</button>
                    )}
                  </div>
                  <select
                    value=""
                    onChange={(e) => { if (!e.target.value) return; if (!canChange(nome, e.target.value).can) return; dispatch({ type: 'CHANGE_TURMA_ALUNO', oldTurmaId: turma.id, newTurmaId: e.target.value, nome }); onClose(); }}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="">Mover para outra {vocab.turma}…</option>
                    {outras.map((t) => { const c = canChange(nome, t.id); return <option key={t.id} value={t.id} disabled={!c.can}>{getTurmaLabel(state.turmas, t.id)}{!c.can ? ` (${c.reason})` : ''}</option>; })}
                  </select>
                  <button onClick={() => { setExpanded(null); setConfirmRemove(nome); }} className="text-xs text-red-400 hover:text-red-600 transition-colors">Remover {vocab.aluno}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function NovaTurmaModal({ dispatch, vocab, existentes, capacidadePadrao, onClose }) {
  const [dia, setDia] = useState('segunda');
  const [hora, setHora] = useState(9);
  const [minuto, setMinuto] = useState(0);
  const [capacidade, setCapacidade] = useState(capacidadePadrao || 7);
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState(null);

  function criar() {
    const hh = String(hora).padStart(2, '0');
    const mm = String(minuto).padStart(2, '0');
    const id = `${dia.slice(0, 3).replace('ç', 'c').replace('á', 'a')}-${hh}${mm}`;
    if (existentes.find((t) => t.id === id)) { setErro('Já existe uma ' + vocab.turma + ' nesse dia e horário.'); return; }
    dispatch({ type: 'ADD_TURMA', diaSemana: dia, hora, minuto, capacidade: Number(capacidade) || 7, observacao });
    onClose();
  }

  return (
    <Modal title={`Nova ${vocab.turma}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Dia da semana</label>
          <select value={dia} onChange={(e) => setDia(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
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
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Observação (opcional)</label>
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="ex.: com Bia" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        {erro && <p className="text-red-600 text-xs">{erro}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={criar} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Criar</button>
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 text-sm">Cancelar</button>
        </div>
      </div>
    </Modal>
  );
}
