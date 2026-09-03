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

export function sortTurmas(turmas) {
  return [...arr(turmas)].sort((a, b) => {
    if (a.id === TURMA_EXTRA_ID) return 1;
    if (b.id === TURMA_EXTRA_ID) return -1;
    const da = DIAS_ORDER.indexOf(a.diaSemana), db = DIAS_ORDER.indexOf(b.diaSemana);
    if (da !== db) return da - db;
    return (a.horario || '').localeCompare(b.horario || '');
  });
}
