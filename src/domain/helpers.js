// Helpers de domínio — portados do Passarinho (index.html), sem alteração de
// lógica. Constantes que eram fixas por escola foram removidas daqui e agora
// vêm do config do tenant (ver src/domain/vocab.js e o config da escola).

export const DIAS_ORDER = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const ABREV = { segunda: 'Seg', terça: 'Ter', quarta: 'Qua', quinta: 'Qui', sexta: 'Sex', sábado: 'Sáb' };
export const EXTENSO = { segunda: 'Segunda-feira', terça: 'Terça-feira', quarta: 'Quarta-feira', quinta: 'Quinta-feira', sexta: 'Sexta-feira', sábado: 'Sábado' };
export const DIA_JS = { segunda: 1, terça: 2, quarta: 3, quinta: 4, sexta: 5, sábado: 6 };
export const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const TURMA_EXTRA_ID = 'turma-extra';

export function genId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

export function arr(v) { return Array.isArray(v) ? v : []; }

// Formata hora/minuto (24h) no estilo do Passarinho: 19h20, 09h.
export function formatHorario(hora, minuto) {
  const h = String(hora).padStart(2, '0');
  const m = Number(minuto) || 0;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

// Encontros da turma (dia + horário). Uma turma pode se encontrar em vários dias
// da semana, com horários diferentes. Normaliza turmas antigas (um só dia).
export function turmaEncontros(t) {
  if (t && Array.isArray(t.encontros) && t.encontros.length) return t.encontros;
  if (!t) return [];
  return [{ diaSemana: t.diaSemana, hora: t.hora, minuto: t.minuto || 0, horario: t.horario }];
}

function encHorario(e) { return e.horario || formatHorario(e.hora, e.minuto); }

// Agrupa os encontros por horário: "Ter/Qui 09h" (mesmo horário) ou
// "Ter 09h · Qui 18h" (horários diferentes). `diaMap` = ABREV ou EXTENSO.
function labelEncontros(t, diaMap, sepDias) {
  const enc = turmaEncontros(t);
  const porHora = [];
  enc.forEach((e) => {
    const h = encHorario(e);
    const grupo = porHora.find((g) => g.h === h);
    const dia = diaMap[e.diaSemana] || e.diaSemana;
    if (grupo) grupo.dias.push(dia); else porHora.push({ h, dias: [dia] });
  });
  return porHora.map((g) => `${g.dias.join(sepDias)} ${g.h}`).join(' · ');
}

export function getTurmaLabel(turmas, id) {
  const t = arr(turmas).find((x) => x.id === id);
  if (!t) return '?';
  if (t.id === TURMA_EXTRA_ID) return 'Extra';
  return labelEncontros(t, EXTENSO, ' e ');
}

export function turmaShortLabel(t) {
  if (!t) return '?';
  if (t.id === TURMA_EXTRA_ID) return 'Extra';
  return labelEncontros(t, ABREV, '/');
}

// ---- Datas (portado do Passarinho) ----
export function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function dateToStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function fmtBR(dateStr) {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}
export function fmtBRFull(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ---- Faltas (portado do Passarinho) ----
export function getFaltaEarliest(falta) {
  return [...arr(falta.datas)].sort()[0];
}
// Validade da falta: config.regras.validadeFaltaDias (0 = não expira).
// Sem config, cai em 30 dias (o padrão histórico), só como fallback.
export function getFaltaExpiry(falta, config) {
  const dias = config && config.regras && config.regras.validadeFaltaDias != null
    ? Number(config.regras.validadeFaltaDias) : 30;
  if (!dias || dias <= 0) return '9999-12-31';
  const d = parseDate(getFaltaEarliest(falta));
  d.setDate(d.getDate() + dias);
  return dateToStr(d);
}

export function getMesNome(mesAno) {
  const [, m] = mesAno.split('-').map(Number);
  return MESES_PT[m - 1];
}
export function getLastDayOfMonth(mesAno) {
  const [y, m] = mesAno.split('-').map(Number);
  return dateToStr(new Date(y, m, 0));
}

// Casa o nome como palavra inteira dentro de um texto de log.
export function nomeExatoMatch(texto, nome) {
  const escaped = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[\\s(,/—])' + escaped + '($|[\\s),/—])', 'i').test(texto);
}

// Cor determinística do autor no histórico (substitui PROFESSOR_COLORS fixo).
const PALETA_AUTOR = [
  { bg: 'bg-pink-100', text: 'text-pink-700', dot: 'bg-pink-400' },
  { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-400' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400' },
  { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-400' },
  { bg: 'bg-teal-100', text: 'text-teal-700', dot: 'bg-teal-400' },
];
export function corDoAutor(nome) {
  if (!nome) return { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
  return PALETA_AUTOR[h % PALETA_AUTOR.length];
}

export function sortTurmas(turmas) {
  const primeiro = (t) => {
    const enc = turmaEncontros(t);
    const ord = [...enc].sort((x, y) => DIAS_ORDER.indexOf(x.diaSemana) - DIAS_ORDER.indexOf(y.diaSemana));
    const e = ord[0] || {};
    return { d: DIAS_ORDER.indexOf(e.diaSemana), h: encHorario(e) };
  };
  return [...arr(turmas)].sort((a, b) => {
    if (a.id === TURMA_EXTRA_ID) return 1;
    if (b.id === TURMA_EXTRA_ID) return -1;
    const pa = primeiro(a), pb = primeiro(b);
    if (pa.d !== pb.d) return pa.d - pb.d;
    return (pa.h || '').localeCompare(pb.h || '');
  });
}
