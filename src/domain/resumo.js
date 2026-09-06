// Resumo do dia — quem está previsto em cada turma numa data.
//
// Portado do computeResumoDia do Passarinho. Duas adaptações ao AVIZ:
// feriado/recesso vêm do config (não de listas fixas), e a turma pode ter
// encontros em vários dias da semana.

import { arr, sortTurmas, TURMA_EXTRA_ID } from './helpers.js';
import { isDataBloqueada, turmaOcorreEm } from './calendario.js';

export function computeResumoDia(state, date, config) {
  if (isDataBloqueada(date, config)) return [];
  const mes = date.slice(0, 7);
  const canceladas = new Set(arr(state.aulasCanceladas).filter((a) => a.data === date).map((a) => a.turmaId));

  return sortTurmas(state.turmas)
    .filter((t) => t.id !== TURMA_EXTRA_ID && arr(t.alunos).length > 0 && turmaOcorreEm(t, date))
    .map((turma) => {
      const faltaram = arr(state.faltas)
        .filter((f) => f.turmaId === turma.id && arr(f.datas).includes(date) && (f.status === 'pendente' || f.status === 'marcada'))
        .map((f) => f.alunoNome);
      const repos = arr(state.reposicoes).filter((r) => r.turmaReposicaoId === turma.id && r.dataReposicao === date);
      const visitantes = repos.filter((r) => r.turmaOrigemId !== turma.id);
      const ferias = arr(state.ausencias)
        .filter((a) => a.turmaId === turma.id && a.mesAno === mes)
        .map((a) => a.alunoNome);
      const presentes = arr(turma.alunos).filter((a) => !faltaram.includes(a) && !ferias.includes(a));
      return {
        turmaId: turma.id,
        cancelada: canceladas.has(turma.id),
        presentes,
        faltaram,
        repondo: repos.map((r) => ({ nome: r.alunoNome, origemTurmaId: r.turmaOrigemId })),
        esperados: presentes.length + visitantes.length,
      };
    });
}
