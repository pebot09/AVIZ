// Vocabulário configurável. Cada escola escolhe como chamar as coisas no
// onboarding (aluno/praticante/atleta…, turma/aula/sessão…). Enquanto o config
// não estiver preenchido, cai num vocabulário neutro em português — isso é só
// um fallback de exibição, não um valor "pré-setado" de regra de negócio.

const PADRAO = {
  aluno: 'aluno', alunos: 'alunos',
  turma: 'turma', turmas: 'turmas',
  professor: 'professor', professores: 'professores',
};

export function makeVocab(config) {
  const v = (config && config.vocab) || {};
  return { ...PADRAO, ...v };
}

// Capitaliza a primeira letra (para começo de frase/título).
export function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
