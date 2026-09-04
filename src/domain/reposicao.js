// Motor de reposição — portado do Passarinho, adaptado ao config.
//
// Diferenças em relação ao original (constantes fixas → config):
//   - capacidade física ("8") → turma.capacidadeFisica || config.regras.capacidadeFisica
//   - janela de abertura da vaga extra (véspera fixa) → config.regras.vagaExtraAbertura
//   - liga/desliga vaga extra → config.regras.vagaExtra
//   - feriado/recesso → config (via calendario)

import { arr, genId, dateToStr, TURMA_EXTRA_ID, fmtBR } from './helpers.js';
import { getClassDatesInRange, getClassDatetime, isFeriado, isRecesso } from './calendario.js';

// ---- Direitos de reposição (falta/férias/crédito), priorizados por expiração ----
export function reposicaoRights(state, alunoNome, turmaOrigemId, td, config) {
  const rights = [];
  arr(state.faltas)
    .filter((f) => f.alunoNome === alunoNome && f.turmaId === turmaOrigemId && f.status === 'pendente')
    .forEach((f) => rights.push({ kind: 'falta', id: f.id, expiry: faltaExpiry(f, config), semAntecedencia: !!f.semAntecedencia }));
  arr(state.ausencias)
    .filter((a) => a.alunoNome === alunoNome && a.turmaId === turmaOrigemId && !a.creditoUsado && a.creditoReposicao > 0)
    .forEach((a) => rights.push({ kind: 'ferias', id: a.id, expiry: ausenciaExpiry(a, config) }));
  arr(state.creditos)
    .filter((c) => c.alunoNome === alunoNome && c.turmaId === turmaOrigemId && !c.usado && c.dataExpiracao >= td)
    .forEach((c) => rights.push({ kind: 'credito', id: c.id, expiry: c.dataExpiracao }));
  return rights;
}

// Escolhe o direito que vence antes. Faltas sem antecedência só valem dentro da
// janela (config.regras.semAntecedenciaJanela) da aula.
export function pickReposicaoRight(rights, dentroJanela) {
  const elegiveis = rights.filter((r) => !(r.kind === 'falta' && r.semAntecedencia) || dentroJanela);
  if (!elegiveis.length) return null;
  return elegiveis.slice().sort((a, b) => a.expiry.localeCompare(b.expiry))[0];
}

export function rightToActionFields(right) {
  if (!right) return { tipo: 'aula_extra' };
  if (right.kind === 'falta') return { faltaId: right.id, tipo: 'reposicao' };
  if (right.kind === 'ferias') return { ausenciaId: right.id };
  return { creditoId: right.id, tipo: 'reposicao_credito' };
}

// Expiração usadas aqui (evita import circular com helpers para falta).
function faltaExpiry(falta, config) {
  const dias = config && config.regras && config.regras.validadeFaltaDias != null ? Number(config.regras.validadeFaltaDias) : 30;
  const base = [...arr(falta.datas)].sort()[0];
  if (!dias || dias <= 0 || !base) return '9999-12-31';
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() + dias);
  return dateToStr(dt);
}
// Validade do crédito de férias: fim do mês + config.regras.feriasValidadeDias (padrão 30).
export function ausenciaExpiry(aus, config) {
  const dias = config && config.regras && config.regras.feriasValidadeDias ? Number(config.regras.feriasValidadeDias) : 30;
  const [y, m] = aus.mesAno.split('-').map(Number);
  const last = new Date(y, m, 0); last.setDate(last.getDate() + dias);
  return dateToStr(last);
}

// Ocupação prevista de uma turma numa data.
export function calcOccupancy(turmaId, date, state) {
  const turma = arr(state.turmas).find((t) => t.id === turmaId);
  if (!turma) return 0;
  const mesAno = date.slice(0, 7);
  const vacCount = arr(state.ausencias).filter((a) => a.turmaId === turmaId && a.mesAno === mesAno && arr(turma.alunos).includes(a.alunoNome)).length;
  const alunosEfetivos = arr(turma.alunos).length - vacCount;
  const faltasOnDate = arr(state.faltas).filter((f) => f.turmaId === turmaId && arr(f.datas).includes(date) && (f.status === 'pendente' || f.status === 'marcada')).length;
  const repos = arr(state.reposicoes).filter((r) => r.turmaReposicaoId === turmaId && r.dataReposicao === date && !r.realizada && r.turmaOrigemId !== turmaId).length;
  return alunosEfetivos - faltasOnDate + repos;
}

export function fmtDatesText(datas) {
  const br = [...arr(datas)].sort().map(fmtBR);
  if (br.length === 1) return br[0];
  if (br.length === 2) return `${br[0]} e ${br[1]}`;
  return br.slice(0, -1).join(', ') + ' e ' + br[br.length - 1];
}

// Deslocamento (horas) de abertura da vaga extra antes do início da aula.
const ABERTURA_HORAS = { vespera: 24, '6h': 6, '12h': 12, '2d': 48, '3d': 72 };

// Recalcula as vagas extras (residuais) por turma/data, respeitando o config.
export function computeVagasExtras(turmas, faltas, reposicoes, vagasBase, td, ausencias, config) {
  ausencias = arr(ausencias);
  let vagas = arr(vagasBase).slice();

  // Vaga extra desligada: remove as extras existentes e para.
  if (!(config && config.regras && config.regras.vagaExtra)) {
    return vagas.filter((v) => !v.vagaExtra);
  }

  const now = new Date();
  const end = (() => { const e = new Date(); e.setDate(e.getDate() + 60); return dateToStr(e); })();
  const offsetH = ABERTURA_HORAS[config.regras.vagaExtraAbertura] ?? 24;

  arr(turmas).forEach((turma) => {
    if (turma.id === TURMA_EXTRA_ID) return;
    if (arr(turma.alunos).length === 0) return;
    const capFisica = Number(turma.capacidadeFisica) || Number(config.regras.capacidadeFisica) || Number(turma.capacidade) || 8;

    getClassDatesInRange(turma, td, end).forEach((date) => {
      if (isFeriado(date, config) || isRecesso(date, config)) return;
      const inicio = getClassDatetime(turma.id, date, turmas);
      const abreEm = inicio ? new Date(inicio.getTime() - offsetH * 3600000) : null;
      if (abreEm && now < abreEm) return; // ainda não abriu

      const mesAno = date.slice(0, 7);
      const vacCount = ausencias.filter((a) => a.turmaId === turma.id && a.mesAno === mesAno && arr(turma.alunos).includes(a.alunoNome)).length;
      const alunosEfetivos = arr(turma.alunos).length - vacCount;
      if (alunosEfetivos <= 0) return;

      const faltasCount = arr(faltas).filter((f) => f.turmaId === turma.id && arr(f.datas).includes(date) && (f.status === 'pendente' || f.status === 'marcada')).length;
      if (faltasCount >= alunosEfetivos) {
        vagas = vagas.filter((v) => !(v.vagaExtra && v.turmaId === turma.id && v.data === date));
        return;
      }
      const totalRepos = arr(reposicoes).filter((r) => r.turmaReposicaoId === turma.id && r.dataReposicao === date && !r.realizada).length;
      const existingFaltaVagas = vagas.filter((v) => v.turmaId === turma.id && v.data === date && (v.faltaId || v.ausenciaId) && !v.vagaExtra).length;
      const target = Math.max(0, capFisica - alunosEfetivos + faltasCount - totalRepos - existingFaltaVagas);
      const existingExtras = vagas.filter((v) => v.vagaExtra && v.turmaId === turma.id && v.data === date);
      const diff = target - existingExtras.length;
      if (diff > 0) {
        for (let i = 0; i < diff; i++) vagas.push({ id: genId('ve'), turmaId: turma.id, data: date, vagaExtra: true, faltaId: null });
      } else if (diff < 0) {
        let toRemove = -diff;
        vagas = vagas.filter((v) => {
          if (v.vagaExtra && v.turmaId === turma.id && v.data === date && toRemove > 0) { toRemove--; return false; }
          return true;
        });
      }
    });
  });
  return vagas;
}
