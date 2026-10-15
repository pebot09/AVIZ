// Guia "primeiros passos" do dono numa escola recém-criada.
//
// O que dá para ver nos dados (turmas, alunos, links) vem do estado. Conferir
// as regras e chamar professores não deixam rastro no estado, então contam
// como feitos quando o dono toca no passo (`marcados`).

import { arr, TURMA_EXTRA_ID } from './helpers.js';

export function primeirosPassos(state, marcados = {}) {
  const turmas = arr(state && state.turmas).filter((t) => t.id !== TURMA_EXTRA_ID);
  return [
    { key: 'regras', feito: !!marcados.regras },
    { key: 'turmas', feito: turmas.length > 0 },
    { key: 'alunos', feito: turmas.some((t) => arr(t.alunos).length > 0) },
    { key: 'link', feito: arr(state && state.acessos).length > 0 },
    { key: 'professores', feito: !!marcados.professores, opcional: true },
  ];
}

// O guia some quando os passos obrigatórios estão feitos.
export function guiaConcluido(passos) {
  return passos.filter((p) => !p.opcional).every((p) => p.feito);
}
