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

export function getTurmaLabel(turmas, id) {
  const t = arr(turmas).find((x) => x.id === id);
  if (!t) return '?';
  if (t.id === TURMA_EXTRA_ID) return 'Extra';
  return `${EXTENSO[t.diaSemana] || t.diaSemana} ${t.horario}`;
}

export function turmaShortLabel(t) {
  if (!t) return '?';
  if (t.id === TURMA_EXTRA_ID) return 'Extra';
  return `${ABREV[t.diaSemana]} ${t.horario}`;
}

// Formata hora/minuto (24h) no estilo do Passarinho: 19h20, 09h.
export function formatHorario(hora, minuto) {
  const h = String(hora).padStart(2, '0');
  const m = Number(minuto) || 0;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
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
  return [...arr(turmas)].sort((a, b) => {
    if (a.id === TURMA_EXTRA_ID) return 1;
    if (b.id === TURMA_EXTRA_ID) return -1;
    const da = DIAS_ORDER.indexOf(a.diaSemana), db = DIAS_ORDER.indexOf(b.diaSemana);
    if (da !== db) return da - db;
    return (a.horario || '').localeCompare(b.horario || '');
  });
}
