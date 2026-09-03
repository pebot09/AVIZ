// Reducer de estado da escola — portado do Passarinho, começando pelas ações de
// Turmas e Alunos. Novas ações (faltas, reposições, ausências…) entram nas
// próximas fatias, reaproveitando o código original.

import { genId, arr, getTurmaLabel, EXTENSO } from './helpers.js';

export const EMPTY_STATE = {
  turmas: [], faltas: [], reposicoes: [], vagas: [],
  ausencias: [], acessos: [], creditos: [], notas: [],
  log: [], estatisticas: { faltasExpiradas: [] },
};

export function normalizeState(data) {
  const s = data && typeof data === 'object' ? data : {};
  return {
    ...EMPTY_STATE,
    ...s,
    turmas: arr(s.turmas), faltas: arr(s.faltas), reposicoes: arr(s.reposicoes),
    vagas: arr(s.vagas), ausencias: arr(s.ausencias), acessos: arr(s.acessos),
    creditos: arr(s.creditos), notas: arr(s.notas), log: arr(s.log),
    estatisticas: { faltasExpiradas: arr((s.estatisticas || {}).faltasExpiradas) },
  };
}

function addLog(log, autor, descricao) {
  const entry = { id: genId('log'), ts: new Date().toISOString(), professor: autor || '?', descricao };
  return [entry, ...arr(log)].slice(0, 6000);
}

export function reducer(state, action) {
  let next = state;
  const autor = action.autor;

  switch (action.type) {
    case 'ADD_TURMA': {
      const { diaSemana, horario, capacidade, observacao } = action;
      const id = `${diaSemana.slice(0, 3).replace('ç', 'c').replace('á', 'a')}-${horario}`;
      if (state.turmas.find((t) => t.id === id)) return state; // já existe esse dia+horário
      const nova = { id, diaSemana, horario, capacidade: capacidade || 7, observacao: observacao || '', alunos: [] };
      next = { ...state, turmas: [...state.turmas, nova] };
      next.log = addLog(state.log, autor, `Criou turma ${EXTENSO[diaSemana] || diaSemana} ${horario}`);
      break;
    }

    case 'DELETE_TURMA': {
      const turmaDel = state.turmas.find((t) => t.id === action.id);
      next = {
        ...state,
        turmas: state.turmas.filter((t) => t.id !== action.id),
        faltas: state.faltas.filter((f) => f.turmaId !== action.id),
        vagas: state.vagas.filter((v) => v.turmaId !== action.id),
        ausencias: state.ausencias.filter((a) => a.turmaId !== action.id),
      };
      if (turmaDel) next.log = addLog(state.log, autor, `Excluiu turma ${getTurmaLabel(state.turmas, turmaDel.id)}`);
      break;
    }

    case 'UPDATE_TURMA': {
      next = {
        ...state,
        turmas: state.turmas.map((t) => t.id === action.id
          ? { ...t, capacidade: action.capacidade ?? t.capacidade, observacao: action.observacao ?? t.observacao }
          : t),
      };
      break;
    }

    case 'ADD_ALUNO': {
      next = {
        ...state,
        turmas: state.turmas.map((t) => {
          if (t.id !== action.turmaId) return t;
          if (arr(t.alunos).includes(action.nome)) return t; // sem duplicar na mesma turma
          return { ...t, alunos: [...arr(t.alunos), action.nome] };
        }),
      };
      if (!state.turmas.find((t) => t.id === action.turmaId)?.alunos?.includes(action.nome)) {
        next.log = addLog(state.log, autor, `Adicionou ${action.nome} à turma ${getTurmaLabel(state.turmas, action.turmaId)}`);
      }
      break;
    }

    case 'REMOVE_ALUNO': {
      next = {
        ...state,
        turmas: state.turmas.map((t) => t.id === action.turmaId
          ? { ...t, alunos: arr(t.alunos).filter((a) => a !== action.nome) }
          : t),
      };
      break;
    }

    case 'RENAME_ALUNO': {
      const { turmaId, oldNome, newNome } = action;
      if (!newNome || newNome === oldNome) return state;
      next = {
        ...state,
        turmas: state.turmas.map((t) => t.id === turmaId
          ? { ...t, alunos: arr(t.alunos).map((a) => (a === oldNome ? newNome : a)) }
          : t),
        faltas: state.faltas.map((f) => (f.turmaId === turmaId && f.alunoNome === oldNome ? { ...f, alunoNome: newNome } : f)),
        reposicoes: state.reposicoes.map((r) => (r.turmaOrigemId === turmaId && r.alunoNome === oldNome ? { ...r, alunoNome: newNome } : r)),
        ausencias: state.ausencias.map((a) => (a.turmaId === turmaId && a.alunoNome === oldNome ? { ...a, alunoNome: newNome } : a)),
        acessos: arr(state.acessos).map((a) => (a.turmaId === turmaId && a.alunoNome === oldNome ? { ...a, alunoNome: newNome } : a)),
      };
      next.log = addLog(state.log, autor, `Renomeou ${oldNome} → ${newNome} (${getTurmaLabel(state.turmas, turmaId)})`);
      break;
    }

    default:
      return state;
  }
  return next;
}
