// Reducer de estado da escola — portado do Passarinho, começando pelas ações de
// Turmas e Alunos. Novas ações (faltas, reposições, ausências…) entram nas
// próximas fatias, reaproveitando o código original.

import { genId, arr, getTurmaLabel, EXTENSO, formatHorario, getFaltaEarliest, fmtBRFull, todayStr, getMesNome, dateToStr } from './helpers.js';
import { isFeriado, isRecesso, mesEhRecesso, getClassDatesInRange } from './calendario.js';
import { computeVagasExtras, fmtDatesText } from './reposicao.js';

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
    estatisticas: {
      faltasExpiradas: arr((s.estatisticas || {}).faltasExpiradas),
      reposCanceladas: arr((s.estatisticas || {}).reposCanceladas),
    },
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
        const datasLbl = fmtDatesText(novasFaltas.map((f) => f.datas[0]));
        next.log = addLog(state.log, autor, `Registrou falta${semAnt ? ' sem antecedência' : ''} de ${alunoNome} (${getTurmaLabel(state.turmas, turmaId)}) — ${datasLbl}`, action.origem);
      }
      break;
    }

    case 'ADD_REPOSICAO': {
      const { alunoNome, dataReposicao, turmaReposicaoId, tipo } = action;
      // Regra: ninguém repõe na própria turma de origem (nenhuma data).
      if (turmaReposicaoId && action.turmaOrigemId && turmaReposicaoId === action.turmaOrigemId) return state;
      const repoId = genId('r');
      const semVagaOficial = action.semVagaOficial || false;
      const vagaRaw = action.vagaSelId ? state.vagas.find((v) => v.id === action.vagaSelId) : null;
      // Se a vaga escolhida é extra mas há vaga de falta/férias no mesmo slot, consome a de falta (mantém a extra livre).
      const vagaConsumed = vagaRaw?.vagaExtra
        ? (state.vagas.find((v) => v.turmaId === turmaReposicaoId && v.data === dataReposicao && (v.faltaId || v.ausenciaId) && !v.vagaExtra) || vagaRaw)
        : vagaRaw;
      const vagaConsumedFaltaId = vagaConsumed?.faltaId || null;
      const vagaConsumedAusenciaId = vagaConsumed?.ausenciaId || null;
      const isVagaExtra = !!vagaConsumed?.vagaExtra;
      const removeVaga = (vs) => (vagaConsumed ? vs.filter((v) => v.id !== vagaConsumed.id) : vs);
      const tRLbl = getTurmaLabel(state.turmas, turmaReposicaoId);

      if (action.ausenciaId) {
        next = {
          ...state,
          ausencias: state.ausencias.map((a) => (a.id === action.ausenciaId ? { ...a, creditoUsado: true } : a)),
          reposicoes: [...state.reposicoes, { id: repoId, alunoNome, turmaOrigemId: action.turmaOrigemId, faltaId: null, ausenciaId: action.ausenciaId, vagaConsumedAusenciaId, dataReposicao, turmaReposicaoId, tipo: 'reposicao_ferias', realizada: false, semVagaOficial, vagaConsumedFaltaId, vagaExtra: isVagaExtra, criadoPor: autor || null, criadoEm: new Date().toISOString() }],
          vagas: removeVaga(state.vagas),
        };
        next.log = addLog(state.log, autor, `Agendou reposição (férias) de ${alunoNome} (${getTurmaLabel(state.turmas, action.turmaOrigemId)}) → ${tRLbl}, ${fmtBRFull(dataReposicao)}`, action.origem);
      } else if (action.creditoId) {
        next = {
          ...state,
          creditos: arr(state.creditos).map((c) => (c.id === action.creditoId ? { ...c, usado: true } : c)),
          reposicoes: [...state.reposicoes, { id: repoId, alunoNome, turmaOrigemId: action.turmaOrigemId, faltaId: null, creditoId: action.creditoId, vagaConsumedFaltaId, vagaExtra: isVagaExtra, dataReposicao, turmaReposicaoId, tipo: 'reposicao_credito', realizada: false, semVagaOficial, criadoPor: autor || null, criadoEm: new Date().toISOString() }],
          vagas: removeVaga(state.vagas),
        };
        next.log = addLog(state.log, autor, `Agendou reposição (crédito extra) de ${alunoNome} (${getTurmaLabel(state.turmas, action.turmaOrigemId)}) → ${tRLbl}, ${fmtBRFull(dataReposicao)}`, action.origem);
      } else if (tipo === 'aula_extra') {
        const turmaOrigemId = action.turmaOrigemId || (state.turmas.find((t) => arr(t.alunos).includes(alunoNome)) || {}).id || null;
        next = {
          ...state,
          reposicoes: [...state.reposicoes, { id: repoId, alunoNome, turmaOrigemId, faltaId: null, dataReposicao, turmaReposicaoId, tipo: 'aula_extra', realizada: false, semVagaOficial, pago: false, vagaConsumedFaltaId, vagaExtra: isVagaExtra, criadoPor: autor || null, criadoEm: new Date().toISOString() }],
          vagas: removeVaga(state.vagas),
        };
        next.log = addLog(state.log, autor, `Agendou aula extra de ${alunoNome} (${getTurmaLabel(state.turmas, turmaOrigemId)}) → ${tRLbl}, ${fmtBRFull(dataReposicao)}`, action.origem);
      } else {
        const pending = action.faltaId
          ? state.faltas.filter((f) => f.id === action.faltaId && f.status === 'pendente')
          : state.faltas.filter((f) => f.alunoNome === alunoNome && f.turmaId === action.turmaOrigemId && f.status === 'pendente' && !f.semAntecedencia).sort((a, b) => getFaltaEarliest(a).localeCompare(getFaltaEarliest(b)));
        if (pending.length) {
          const oldest = pending[0];
          next = {
            ...state,
            faltas: state.faltas.map((f) => (f.id === oldest.id ? { ...f, status: 'marcada', reposicaoId: repoId } : f)),
            reposicoes: [...state.reposicoes, { id: repoId, alunoNome, turmaOrigemId: oldest.turmaId, faltaId: oldest.id, dataReposicao, turmaReposicaoId, tipo: 'reposicao', realizada: false, semVagaOficial, vagaConsumedFaltaId, vagaExtra: isVagaExtra, criadoPor: autor || null, criadoEm: new Date().toISOString() }],
            vagas: removeVaga(state.vagas),
          };
          next.log = addLog(state.log, autor, `Agendou reposição de ${alunoNome} (${getTurmaLabel(state.turmas, oldest.turmaId)}) → ${tRLbl}, ${fmtBRFull(dataReposicao)}`, action.origem);
        } else {
          const turmaOrigemId = action.turmaOrigemId || (state.turmas.find((t) => arr(t.alunos).includes(alunoNome)) || {}).id || null;
          next = {
            ...state,
            reposicoes: [...state.reposicoes, { id: repoId, alunoNome, turmaOrigemId, faltaId: null, dataReposicao, turmaReposicaoId, tipo: 'reposicao', realizada: false, semVagaOficial, vagaConsumedFaltaId, vagaExtra: isVagaExtra, semFaltaVinculada: true, observacao: 'Reposição sem falta vinculada — verificar', criadoPor: autor || null, criadoEm: new Date().toISOString() }],
            vagas: removeVaga(state.vagas),
          };
          next.log = addLog(state.log, autor, `Agendou reposição de ${alunoNome} (${getTurmaLabel(state.turmas, turmaOrigemId)}) → ${tRLbl}, ${fmtBRFull(dataReposicao)}`, action.origem);
        }
      }
      // Recalcula vagas extras após o agendamento.
      next = { ...next, vagas: computeVagasExtras(next.turmas, next.faltas, next.reposicoes, next.vagas, todayStr(), next.ausencias, config) };
      break;
    }

    case 'CANCEL_FALTA': {
      const falta = state.faltas.find((f) => f.id === action.id);
      if (!falta) return state;
      let newVagas = state.vagas.filter((v) => v.faltaId !== falta.id);
      let newRepos = state.reposicoes;
      const repoVinc = state.reposicoes.find((r) => r.vagaConsumedFaltaId === falta.id);
      if (repoVinc) {
        const outraVaga = newVagas.find((v) => v.turmaId === repoVinc.turmaReposicaoId && v.data === repoVinc.dataReposicao);
        if (outraVaga) {
          newRepos = newRepos.map((r) => (r.id === repoVinc.id ? { ...r, vagaConsumedFaltaId: outraVaga.faltaId || null, vagaConsumedAusenciaId: outraVaga.ausenciaId || null, vagaExtra: !!outraVaga.vagaExtra } : r));
          newVagas = newVagas.filter((v) => v.id !== outraVaga.id);
        } else {
          newRepos = newRepos.map((r) => (r.id === repoVinc.id ? { ...r, vagaConsumedFaltaId: null } : r));
        }
      }
      const newFaltas = state.faltas.filter((f) => f.id !== falta.id);
      const vagasFinal = computeVagasExtras(state.turmas, newFaltas, newRepos, newVagas, todayStr(), state.ausencias, config);
      next = { ...state, faltas: newFaltas, vagas: vagasFinal, reposicoes: newRepos };
      next.log = addLog(state.log, autor, `Cancelou falta de ${falta.alunoNome} (${getTurmaLabel(state.turmas, falta.turmaId)}) — ${fmtBRFull(falta.datas[0])}`, action.origem);
      break;
    }

    case 'CANCEL_REPOSICAO': {
      const repo = state.reposicoes.find((r) => r.id === action.id);
      if (!repo) return state;
      const registraCancel = (nx) => ({ ...nx, estatisticas: { ...(nx.estatisticas || {}), reposCanceladas: [...arr((nx.estatisticas || {}).reposCanceladas), { alunoNome: repo.alunoNome, turmaId: repo.turmaOrigemId, turmaReposicaoId: repo.turmaReposicaoId, dataReposicao: repo.dataReposicao, semCredito: false, ts: new Date().toISOString() }] } });

      if (repo.tipo === 'reposicao_ferias') {
        const restRepos = state.reposicoes.filter((r) => r.id !== repo.id);
        let newVagas = state.vagas;
        let newAus = state.ausencias;
        if (repo.ausenciaId) newAus = newAus.map((a) => (a.id === repo.ausenciaId ? { ...a, creditoUsado: false } : a));
        if (repo.vagaConsumedAusenciaId) {
          if (!newVagas.some((v) => v.ausenciaId === repo.vagaConsumedAusenciaId && v.turmaId === repo.turmaReposicaoId && v.data === repo.dataReposicao)) newVagas = [...newVagas, { id: genId('vf'), turmaId: repo.turmaReposicaoId, data: repo.dataReposicao, tipo: 'ferias', ausenciaId: repo.vagaConsumedAusenciaId }];
        } else if (repo.vagaConsumedFaltaId) {
          if (!newVagas.some((v) => v.turmaId === repo.turmaReposicaoId && v.data === repo.dataReposicao && v.faltaId === repo.vagaConsumedFaltaId)) newVagas = [...newVagas, { id: genId('v'), turmaId: repo.turmaReposicaoId, data: repo.dataReposicao, faltaId: repo.vagaConsumedFaltaId }];
        }
        next = registraCancel({ ...state, vagas: newVagas, reposicoes: restRepos, ausencias: newAus });
        next.log = addLog(state.log, autor, `Cancelou reposição (férias) de ${repo.alunoNome} (${getTurmaLabel(state.turmas, repo.turmaOrigemId)}) → ${getTurmaLabel(state.turmas, repo.turmaReposicaoId)} ${fmtBRFull(repo.dataReposicao)}`, action.origem);
        break;
      }

      if (repo.tipo === 'reposicao_credito') {
        const restRepos = state.reposicoes.filter((r) => r.id !== repo.id);
        let newVagas = state.vagas;
        let newCred = state.creditos;
        if (repo.creditoId) newCred = arr(newCred).map((c) => (c.id === repo.creditoId ? { ...c, usado: false } : c));
        if (repo.vagaConsumedFaltaId && !newVagas.some((v) => v.turmaId === repo.turmaReposicaoId && v.data === repo.dataReposicao && v.faltaId === repo.vagaConsumedFaltaId)) newVagas = [...newVagas, { id: genId('v'), turmaId: repo.turmaReposicaoId, data: repo.dataReposicao, faltaId: repo.vagaConsumedFaltaId }];
        next = registraCancel({ ...state, vagas: newVagas, reposicoes: restRepos, creditos: newCred });
        next.log = addLog(state.log, autor, `Cancelou reposição (crédito extra) de ${repo.alunoNome} (${getTurmaLabel(state.turmas, repo.turmaOrigemId)}) → ${getTurmaLabel(state.turmas, repo.turmaReposicaoId)} ${fmtBRFull(repo.dataReposicao)}`, action.origem);
        break;
      }

      const restRepos = state.reposicoes.filter((r) => r.id !== repo.id);
      const activeRepos = restRepos.filter((r) => r.alunoNome === repo.alunoNome && r.turmaOrigemId === repo.turmaOrigemId && !r.realizada && r.faltaId).sort((a, b) => getFaltaEarliest(a).localeCompare(getFaltaEarliest(b)));
      const marcadas = state.faltas.filter((f) => f.alunoNome === repo.alunoNome && f.turmaId === repo.turmaOrigemId && f.status === 'marcada').sort((a, b) => getFaltaEarliest(a).localeCompare(getFaltaEarliest(b)));
      let newFaltas = state.faltas;
      let newVagas = state.vagas;
      let newReposicoes = restRepos;
      marcadas.forEach((falta, i) => {
        if (i < activeRepos.length) {
          newFaltas = newFaltas.map((f) => (f.id === falta.id ? { ...f, reposicaoId: activeRepos[i].id } : f));
          newReposicoes = newReposicoes.map((r) => (r.id === activeRepos[i].id ? { ...r, faltaId: falta.id } : r));
        } else {
          newFaltas = newFaltas.map((f) => (f.id === falta.id ? { ...f, status: 'pendente', reposicaoId: undefined, ...(action.converterSemAntecedencia ? { semAntecedencia: true } : {}) } : f));
          const extra = arr(falta.datas).filter((d) => !newVagas.some((v) => v.turmaId === falta.turmaId && v.data === d && v.faltaId === falta.id)).map((d) => ({ id: genId('v'), turmaId: falta.turmaId, data: d, faltaId: falta.id }));
          newVagas = [...newVagas, ...extra];
        }
      });
      if (repo.vagaConsumedFaltaId && !newVagas.some((v) => v.turmaId === repo.turmaReposicaoId && v.data === repo.dataReposicao && v.faltaId === repo.vagaConsumedFaltaId)) newVagas = [...newVagas, { id: genId('v'), turmaId: repo.turmaReposicaoId, data: repo.dataReposicao, faltaId: repo.vagaConsumedFaltaId }];
      if (repo.vagaConsumedAusenciaId && !newVagas.some((v) => v.ausenciaId === repo.vagaConsumedAusenciaId && v.turmaId === repo.turmaReposicaoId && v.data === repo.dataReposicao)) newVagas = [...newVagas, { id: genId('vf'), turmaId: repo.turmaReposicaoId, data: repo.dataReposicao, tipo: 'ferias', ausenciaId: repo.vagaConsumedAusenciaId }];
      next = registraCancel({ ...state, faltas: newFaltas, vagas: newVagas, reposicoes: newReposicoes });
      next.log = addLog(state.log, autor, `Cancelou reposição de ${repo.alunoNome} (${getTurmaLabel(state.turmas, repo.turmaOrigemId)}) → ${getTurmaLabel(state.turmas, repo.turmaReposicaoId)} ${fmtBRFull(repo.dataReposicao)}${action.converterSemAntecedencia ? ' (crédito convertido p/ sem antecedência)' : ''}`, action.origem);
      break;
    }

    case 'CANCEL_REPOSICAO_SEM_CREDITO': {
      const repo = state.reposicoes.find((r) => r.id === action.id);
      if (!repo) return state;
      const restRepos = state.reposicoes.filter((r) => r.id !== repo.id);
      let newVagas = state.vagas;
      if (repo.vagaConsumedFaltaId && !newVagas.some((v) => v.turmaId === repo.turmaReposicaoId && v.data === repo.dataReposicao && v.faltaId === repo.vagaConsumedFaltaId)) newVagas = [...newVagas, { id: genId('v'), turmaId: repo.turmaReposicaoId, data: repo.dataReposicao, faltaId: repo.vagaConsumedFaltaId }];
      if (repo.vagaConsumedAusenciaId && !newVagas.some((v) => v.ausenciaId === repo.vagaConsumedAusenciaId && v.turmaId === repo.turmaReposicaoId && v.data === repo.dataReposicao)) newVagas = [...newVagas, { id: genId('vf'), turmaId: repo.turmaReposicaoId, data: repo.dataReposicao, tipo: 'ferias', ausenciaId: repo.vagaConsumedAusenciaId }];
      const faltaVinc = repo.faltaId ? state.faltas.find((f) => f.id === repo.faltaId) : state.faltas.find((f) => f.reposicaoId === repo.id && f.status === 'marcada');
      let newFaltas = state.faltas;
      let newExp = arr((state.estatisticas || {}).faltasExpiradas);
      if (faltaVinc) {
        newFaltas = state.faltas.filter((f) => f.id !== faltaVinc.id);
        newVagas = newVagas.filter((v) => v.faltaId !== faltaVinc.id);
        newExp = [...newExp, { alunoNome: faltaVinc.alunoNome, turmaId: faltaVinc.turmaId, data: faltaVinc.datas[0], expiradaEm: todayStr() }];
      }
      next = { ...state, reposicoes: restRepos, vagas: newVagas, faltas: newFaltas };
      next.log = addLog(state.log, autor, `Cancelou reposição sem crédito — ${repo.alunoNome} (${getTurmaLabel(state.turmas, repo.turmaOrigemId)}) → ${getTurmaLabel(state.turmas, repo.turmaReposicaoId)} ${fmtBRFull(repo.dataReposicao)}`, action.origem);
      next.estatisticas = { ...(next.estatisticas || {}), faltasExpiradas: newExp, reposCanceladas: [...arr((next.estatisticas || {}).reposCanceladas), { alunoNome: repo.alunoNome, turmaId: repo.turmaOrigemId, turmaReposicaoId: repo.turmaReposicaoId, dataReposicao: repo.dataReposicao, semCredito: true, ts: new Date().toISOString() }] };
      break;
    }

    case 'ADD_AUSENCIA': {
      const { alunoNome, turmaId, tipo, mesAno } = action;
      // Duplicata: mesmo aluno/turma/mês.
      if (state.ausencias.some((a) => a.alunoNome === alunoNome && a.turmaId === turmaId && a.mesAno === mesAno)) return state;
      // Limite por ano — POR ALUNO (decisão do AVIZ), config.regras.feriasLimiteAno (0 = ilimitado).
      const ano = mesAno.slice(0, 4);
      const limite = Number(config?.regras?.feriasLimiteAno) || 0;
      if (!action.professorOverride && limite > 0) {
        const noAno = state.ausencias.filter((a) => a.alunoNome === alunoNome && a.mesAno.slice(0, 4) === ano).length;
        if (noAno >= limite) return state;
      }
      // Crédito: só se a escola oferece crédito de férias e o mês não é de recesso.
      const daCredito = !!(config?.regras?.ferias && config?.regras?.feriasCredito) && !mesEhRecesso(mesAno, config);
      const qtd = daCredito ? (Number(config?.regras?.feriasCreditos) || 1) : 0;
      const ausId = genId('aus');
      const nova = { id: ausId, alunoNome, turmaId, tipo: tipo || 'ferias', mesAno, creditoReposicao: qtd, creditoUsado: !daCredito };
      const newAus = [...state.ausencias, nova];
      // Uma vaga de férias por data de aula do mês (menos feriado/recesso).
      const turma = state.turmas.find((t) => t.id === turmaId);
      const vagasFerias = [];
      if (turma) {
        const [y, m] = mesAno.split('-').map(Number);
        const first = `${mesAno}-01`;
        const last = dateToStr(new Date(y, m, 0));
        getClassDatesInRange(turma, first, last).forEach((date) => {
          if (isFeriado(date, config) || isRecesso(date, config)) return;
          vagasFerias.push({ id: genId('vf'), turmaId, data: date, tipo: 'ferias', ausenciaId: ausId });
        });
      }
      const vagas = computeVagasExtras(state.turmas, state.faltas, state.reposicoes, [...state.vagas, ...vagasFerias], todayStr(), newAus, config);
      next = { ...state, ausencias: newAus, vagas };
      next.log = addLog(state.log, autor, `Registrou férias de ${alunoNome} (${getTurmaLabel(state.turmas, turmaId)}) — ${getMesNome(mesAno).toLowerCase()}`, action.origem);
      break;
    }

    case 'USE_AUSENCIA_CREDITO': {
      next = { ...state, ausencias: state.ausencias.map((a) => (a.id === action.id ? { ...a, creditoUsado: true } : a)) };
      break;
    }

    case 'DELETE_AUSENCIA': {
      const ausDel = state.ausencias.find((a) => a.id === action.id);
      const newAus = state.ausencias.filter((a) => a.id !== action.id);
      const vagasSemAus = state.vagas.filter((v) => v.ausenciaId !== action.id);
      const vagas = computeVagasExtras(state.turmas, state.faltas, state.reposicoes, vagasSemAus, todayStr(), newAus, config);
      next = { ...state, ausencias: newAus, vagas };
      if (ausDel) next.log = addLog(state.log, autor, `Removeu férias de ${ausDel.alunoNome} (${getTurmaLabel(state.turmas, ausDel.turmaId)}) — ${getMesNome(ausDel.mesAno).toLowerCase()}`, action.origem);
      break;
    }

    case 'CLEANUP': {
      // Recalcula vagas extras (roda no load; expiração entra em fatia futura).
      const vagas = computeVagasExtras(state.turmas, state.faltas, state.reposicoes, state.vagas, todayStr(), state.ausencias, config);
      const igual = vagas.length === state.vagas.length && vagas.every((v, i) => v.id === state.vagas[i].id);
      if (igual) return state; // nada mudou → não grava (evita churn no load)
      next = { ...state, vagas };
      break;
    }

    default:
      return state;
  }
  return next;
}
