// Backup automático do estado da escola.
//
// Rede de segurança: mesmo com a gravação já consertada, um estado bom é
// copiado para um anel de backups a cada carregamento (com intervalo mínimo),
// para que nenhum susto futuro signifique perder os dados de um cliente.
//
// Só funções puras aqui — a gravação em si fica no store. Assim dá para testar
// a decisão ("faz backup agora?", "o que podar?") sem tocar no Firebase.

import { arr, TURMA_EXTRA_ID } from './helpers.js';

const SEIS_HORAS = 6 * 60 * 60 * 1000;
export const MAX_BACKUPS = 10;

// Resumo leve, para listar backups sem abrir cada um.
export function contarEstado(state) {
  const turmas = arr(state && state.turmas).filter((t) => t.id !== TURMA_EXTRA_ID).length;
  const alunos = arr(state && state.turmas).reduce((n, t) => n + arr(t.alunos).length, 0);
  return {
    turmas,
    alunos,
    faltas: arr(state && state.faltas).length,
    reposicoes: arr(state && state.reposicoes).length,
    ausencias: arr(state && state.ausencias).length,
  };
}

// Vazio não vale backup (escola recém-criada, ou um estado já corrompido).
export function estadoTemConteudo(state) {
  const c = contarEstado(state);
  return c.turmas > 0 || c.alunos > 0 || c.faltas > 0 || c.reposicoes > 0 || c.ausencias > 0;
}

// Faz backup se ainda não há nenhum, ou se o mais recente é mais velho que o
// intervalo — para abrir o app várias vezes no dia não encher de backups.
export function deveFazerBackup(backups, agora, minIntervaloMs = SEIS_HORAS) {
  const ts = Object.values(backups || {}).map((b) => Number(b && b.ts) || 0);
  if (!ts.length) return true;
  return agora - Math.max(...ts) >= minIntervaloMs;
}

// Chaves dos backups a remover para manter só os `max` mais novos.
export function chavesParaPodar(backups, max = MAX_BACKUPS) {
  const ent = Object.entries(backups || {}).sort(
    (a, b) => (Number(a[1] && a[1].ts) || 0) - (Number(b[1] && b[1].ts) || 0),
  );
  const excesso = ent.length - max;
  return excesso > 0 ? ent.slice(0, excesso).map((e) => e[0]) : [];
}

// Monta a entrada de backup a gravar.
export function montarBackup(state, agora) {
  return { ts: agora, resumo: contarEstado(state), dados: state };
}
