// Reducer de estado da escola — portado do Passarinho, começando pelas ações de
// Turmas e Alunos. Novas ações (faltas, reposições, ausências…) entram nas
// próximas fatias, reaproveitando o código original.

import { genId, arr, getTurmaLabel, EXTENSO, formatHorario } from './helpers.js';
import { isFeriado, isRecesso } from './calendario.js';

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

function addLog(log, autor, descricao, origem) {
  const entry = { id: genId('log'), ts: new Date().toISOString(), professor: autor || '?', descricao };
  if (origem) entry.origem = origem;
  return [entry, ...arr(log)].slice(0, 6000);
}

export function reducer(state, action, config) {
  let next = state;
  const autor = action.autor;

  switch (action.type) {
    case 'ADD_TURMA': {
      const { diaSemana, hora, minuto, capacidade, observacao } = action;
      const hh = String(hora).padStart(2, '0');
      const mm = String(Number(minuto) || 0).padStart(2, '0');
      const id = `${diaSemana.slice(0, 3).replace('ç', 'c').replace('á', 'a')}-${hh}${mm}`;
      if (state.turmas.find((t) => t.id === id)) return state; // já existe esse dia+horário
      const horario = formatHorario(hora, minuto);
      const nova = { id, diaSemana, hora: Number(hora), minuto: Number(minuto) || 0, horario, capacidade: capacidade || 7, observacao: observacao || '', alunos: [] };
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

    case 'CHANGE_TURMA_ALUNO': {
      const { oldTurmaId, newTurmaId, nome } = action;
      if (!oldTurmaId || !newTurmaId || oldTurmaId === newTurmaId) return state;
      const destino = state.turmas.find((t) => t.id === newTurmaId);
      if (destino && arr(destino.alunos).includes(nome)) return state; // já existe nome igual na turma destino
      next = {
        ...state,
        turmas: state.turmas.map((t) => {
          if (t.id === oldTurmaId) return { ...t, alunos: arr(t.alunos).filter((a) => a !== nome) };
          if (t.id === newTurmaId) return arr(t.alunos).includes(nome) ? t : { ...t, alunos: [...arr(t.alunos), nome] };
          return t;
        }),
        faltas: state.faltas.map((f) => (f.turmaId === oldTurmaId && f.alunoNome === nome ? { ...f, turmaId: newTurmaId } : f)),
        reposicoes: state.reposicoes.map((r) => (r.turmaOrigemId === oldTurmaId && r.alunoNome === nome ? { ...r, turmaOrigemId: newTurmaId } : r)),
        ausencias: state.ausencias.map((a) => (a.turmaId === oldTurmaId && a.alunoNome === nome ? { ...a, turmaId: newTurmaId } : a)),
        acessos: arr(state.acessos).map((a) => (a.turmaId === oldTurmaId && a.alunoNome === nome ? { ...a, turmaId: newTurmaId } : a)),
      };
      next.log = addLog(state.log, autor, `Moveu ${nome} de ${getTurmaLabel(state.turmas, oldTurmaId)} → ${getTurmaLabel(state.turmas, newTurmaId)}`);
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

    case 'ADD_FALTA': {
      const { alunoNome, turmaId } = action;
      const datasRaw = action.datasComTipo || arr(action.datas).map((d) => ({ data: d, semAntecedencia: false }));
      // Feriado/recesso nunca viram falta (datas bloqueadas).
      const datas = datasRaw.filter(({ data }) => !isFeriado(data, config) && !isRecesso(data, config));
      const novasFaltas = [];
      const novasVagas = [];
      let reposicoes = state.reposicoes;
      datas.forEach(({ data, semAntecedencia }) => {
        const existe = state.faltas.some((f) => f.alunoNome === alunoNome && f.turmaId === turmaId && arr(f.datas).includes(data) && (f.status === 'pendente' || f.status === 'marcada'));
        if (existe) return;
        const faltaId = genId('f');
        novasFaltas.push({ id: faltaId, alunoNome, turmaId, datas: [data], status: 'pendente', semAntecedencia: !!semAntecedencia, criadoPor: autor || null, criadoEm: new Date().toISOString() });
        // Se já havia reposição marcada nessa turma/data sem vaga própria, ela regulariza para esta falta.
        const repoOrfao = reposicoes.find((r) => r.turmaReposicaoId === turmaId && r.dataReposicao === data && !r.realizada && !r.vagaConsumedFaltaId);
        if (repoOrfao) {
          reposicoes = reposicoes.map((r) => (r.id === repoOrfao.id ? { ...r, vagaConsumedFaltaId: faltaId, vagaExtra: false, semVagaOficial: false } : r));
        } else {
          novasVagas.push({ id: genId('v'), turmaId, data, faltaId });
        }
      });
      next = { ...state, faltas: [...state.faltas, ...novasFaltas], vagas: [...state.vagas, ...novasVagas], reposicoes };
      if (novasFaltas.length) {
        const semAnt = novasFaltas.some((f) => f.semAntecedencia);
        next.log = addLog(state.log, autor, `Registrou falta${semAnt ? ' sem antecedência' : ''} de ${alunoNome} (${getTurmaLabel(state.turmas, turmaId)})`, action.origem);
      }
      break;
    }

    default:
      return state;
  }
  return next;
}
