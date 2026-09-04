// Calendário — datas de aula, feriados e recesso.
//
// Diferente do Passarinho (feriados de 2026 e recesso jul/dez fixos no código),
// aqui os feriados NACIONAIS são calculados por ano (inclusive os móveis, a
// partir da Páscoa) e os municipais + recessos vêm do config da escola.

import { DIA_JS, parseDate, dateToStr, arr, turmaEncontros } from './helpers.js';

const DIAS_NOMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function getDiaSemanaFromDateStr(dateStr) {
  const d = parseDate(dateStr);
  return DIAS_NOMES[d.getDay()];
}

// Dias-alvo (0..6) de todos os encontros da turma.
function diasAlvo(turma) {
  return new Set(turmaEncontros(turma).map((e) => DIA_JS[e.diaSemana]).filter((x) => x !== undefined));
}

// Próximas n ocorrências da turma (todos os dias de encontro; inclui feriados —
// a UI mostra disabled).
export function getNextOccurrences(turma, n = 8) {
  const alvos = diasAlvo(turma);
  if (!alvos.size) return [];
  const dates = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 0; dates.length < n && i < 400; i++) {
    if (alvos.has(d.getDay())) dates.push(dateToStr(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export function getClassDatesInRange(turma, fromStr, toStr) {
  const alvos = diasAlvo(turma);
  if (!alvos.size) return [];
  const dates = [];
  const d = new Date(fromStr + 'T00:00:00');
  const end = new Date(toStr + 'T00:00:00');
  while (d <= end) {
    if (alvos.has(d.getDay())) dates.push(dateToStr(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// Momento de início da aula naquela data: acha o encontro cujo dia bate com a
// data (turma pode ter horários diferentes por dia).
export function getClassDatetime(turmaId, date, turmas) {
  const turma = arr(turmas).find((t) => t.id === turmaId);
  if (!turma) return null;
  const enc = turmaEncontros(turma);
  const wd = parseDate(date).getDay();
  const slot = enc.find((e) => DIA_JS[e.diaSemana] === wd) || enc[0];
  if (!slot) return null;
  const dt = parseDate(date);
  let hora = slot.hora;
  let minuto = slot.minuto || 0;
  if (hora === undefined || hora === null) {
    const [hh, mm] = String(slot.horario || '09h').split('h');
    hora = parseInt(hh, 10) || 0;
    minuto = parseInt(mm, 10) || 0;
  }
  dt.setHours(hora, minuto, 0, 0);
  return dt;
}

// ---- Feriados nacionais (BR), calculados por ano ----
// Domingo de Páscoa (algoritmo de Meeus/Butcher).
function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}
function maisDias(base, n) { const d = new Date(base); d.setDate(d.getDate() + n); return d; }

export function feriadosNacionais(ano) {
  const p = pascoa(ano);
  const fixos = {
    [`${ano}-01-01`]: 'Confraternização Universal',
    [`${ano}-04-21`]: 'Tiradentes',
    [`${ano}-05-01`]: 'Dia do Trabalho',
    [`${ano}-09-07`]: 'Independência',
    [`${ano}-10-12`]: 'Nossa Senhora Aparecida',
    [`${ano}-11-02`]: 'Finados',
    [`${ano}-11-15`]: 'Proclamação da República',
    [`${ano}-11-20`]: 'Consciência Negra',
    [`${ano}-12-25`]: 'Natal',
  };
  const moveis = {
    [dateToStr(maisDias(p, -48))]: 'Carnaval',
    [dateToStr(maisDias(p, -47))]: 'Carnaval',
    [dateToStr(maisDias(p, -2))]: 'Sexta-feira Santa',
    [dateToStr(maisDias(p, 60))]: 'Corpus Christi',
  };
  return { ...fixos, ...moveis };
}

const _cacheFeriados = {};
function feriadosDoAno(ano) {
  if (!_cacheFeriados[ano]) _cacheFeriados[ano] = feriadosNacionais(ano);
  return _cacheFeriados[ano];
}

// Nome do feriado nessa data (nacional + municipais do config), ou null.
// Um feriado que a escola marcou como "não paralisa" não conta.
export function feriadoNome(dateStr, config) {
  if (!dateStr) return null;
  const ano = Number(dateStr.slice(0, 4));
  const naoParalisa = new Set(arr(config && config.calendario && config.calendario.feriadosIgnorados));
  if (naoParalisa.has(dateStr)) return null;
  const nac = feriadosDoAno(ano)[dateStr];
  if (nac) return nac;
  const mun = arr(config && config.calendario && config.calendario.feriadosMunicipais).find((f) => f.data === dateStr);
  return mun ? mun.nome : null;
}

// Nome do recesso nessa data (períodos do config), ou null.
export function recessoNome(dateStr, config) {
  if (!dateStr) return null;
  const recessos = arr(config && config.calendario && config.calendario.recessos);
  for (const r of recessos) {
    if (r.de && r.ate && dateStr >= r.de && dateStr <= r.ate) return r.nome || 'Recesso';
  }
  return null;
}

export function isRecesso(dateStr, config) { return !!recessoNome(dateStr, config); }

// Mês (YYYY-MM) tocado por algum recesso → não gera crédito de férias.
// É a derivação "meses sem crédito vêm dos recessos" que combinamos.
export function mesEhRecesso(mesAno, config) {
  const [y, m] = mesAno.split('-').map(Number);
  const first = `${mesAno}-01`;
  const last = dateToStr(new Date(y, m, 0));
  return arr(config && config.calendario && config.calendario.recessos).some((r) => r.de && r.ate && r.de <= last && r.ate >= first);
}
export function isFeriado(dateStr, config) { return !!feriadoNome(dateStr, config); }
// Data bloqueada para aula (feriado ou recesso).
export function isDataBloqueada(dateStr, config) { return isFeriado(dateStr, config) || isRecesso(dateStr, config); }
