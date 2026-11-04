// Escola fictícia "Ateliê Barro Bom", para gravar o vídeo de demonstração.
//
// Só monta os dados (função pura, testada em test/escola-demo-smoke.mjs). Quem
// grava no banco é scripts/escola-demo.mjs. As datas saem de "hoje", então a
// escola fica certa no dia em que o script rodar: faltas perto de vencer
// aparecem em amarelo, há vagas para repor, e o Resumo do dia tem gente.

import { reducer, normalizeState } from '../src/domain/reducer.js';
import { arr, dateToStr, TURMA_EXTRA_ID } from '../src/domain/helpers.js';
import { getNextOccurrences, isDataBloqueada } from '../src/domain/calendario.js';

export const SLUG_DEMO = 'atelie-barro-bom';
export const PROTAGONISTA = 'Marina Costa';

export const CONFIG_DEMO = {
  vocab: {
    aluno: 'aluno', alunos: 'alunos', turma: 'turma', turmas: 'turmas',
    professor: 'professor', professores: 'professores', espacoArtigo: 'o',
  },
  regras: {
    capacidadeNominal: 7, capacidadeFisica: 8,
    antecedenciaHoras: 2, semAntecedencia: false, semAntecedenciaJanela: 0,
    validadeFaltaDias: 30,
    vagaExtra: true, vagaExtraAbertura: '3d',
    ferias: true, feriasCredito: true, feriasCreditos: 2, feriasValidadeDias: 30, feriasLimiteAno: 1,
  },
  calendario: { recessos: [], feriadosMunicipais: [], feriadosIgnorados: [] },
};

// Turmas da lista do roteiro. Capacidade 7: lotada = 7, "2 vagas" = 5, "1 vaga" = 6.
const TURMAS = [
  { dia: 'terça', hora: 19, obs: 'Torno', alunos: [PROTAGONISTA, 'Bruno Lima', 'Carla Dias', 'Diego Rocha', 'Elisa Prado', 'Fábio Nunes', 'Gabi Moura'] },
  { dia: 'quarta', hora: 10, obs: 'Modelagem', alunos: ['Helena Reis', 'Igor Matos', 'Júlia Paz', 'Lucas Melo', 'Mônica Sá'] },
  { dia: 'sábado', hora: 9, obs: 'Torno', alunos: ['Nina Alves', 'Otávio Lins', 'Paula Teles', 'Rafael Brito', 'Sara Vidal', 'Tiago Leal'] },
  { dia: 'quinta', hora: 18, obs: 'Esmaltação', alunos: ['Úrsula Pinto', 'Vera Campos', 'Wagner Dutra', 'Yara Fontes', 'Zeca Ramos', 'Alice Gomes', 'Beto Cunha'] },
];

// Datas de aula já passadas de uma turma, da mais recente para trás.
function aulasPassadas(turma, hoje, quantas, config) {
  const out = [];
  const d = new Date(hoje);
  d.setDate(d.getDate() - 1);
  const dias = { domingo: 0, segunda: 1, terça: 2, quarta: 3, quinta: 4, sexta: 5, sábado: 6 };
  const alvo = dias[turma.encontros[0].diaSemana];
  for (let i = 0; i < 120 && out.length < quantas; i++) {
    const s = dateToStr(d);
    if (d.getDay() === alvo && !isDataBloqueada(s, config)) out.push(s);
    d.setDate(d.getDate() - 1);
  }
  return out;
}

const diasAtras = (hoje, n) => { const d = new Date(hoje); d.setDate(d.getDate() - n); return dateToStr(d); };

// → { state, config, publico, codigoMarina }
export function montarEscolaDemo(hoje = new Date(), config = CONFIG_DEMO) {
  let s = normalizeState({});
  const d = (acao) => { s = reducer(s, { autor: 'Equipe', ...acao }, config); };

  for (const t of TURMAS) {
    d({ type: 'ADD_TURMA', encontros: [{ diaSemana: t.dia, hora: t.hora, minuto: 0 }], capacidade: 7, observacao: t.obs });
    const nova = s.turmas[s.turmas.length - 1];
    d({ type: 'ADD_ALUNOS', turmaId: nova.id, nomes: t.alunos });
  }
  const [terca, quarta, sabado, quinta] = s.turmas.filter((t) => t.id !== TURMA_EXTRA_ID);

  // Faltas pendentes de outros alunos: 2 perto de vencer (validade 30 dias,
  // faltas de 23 a 29 dias atrás → vencem nos próximos 7 dias) e 2 recentes.
  // Janela de 7 dias (23 a 29 dias atrás) → toda turma semanal tem uma aula
  // nela, e a falta vence entre amanhã e daqui a 7 dias.
  const perto = (turma) => aulasPassadas(turma, hoje, 8, config).find((x) => x <= diasAtras(hoje, 23) && x >= diasAtras(hoje, 29));
  const pendentes = [
    { aluno: 'Bruno Lima', turma: terca, data: perto(terca) },
    { aluno: 'Vera Campos', turma: quinta, data: perto(quinta) },
    { aluno: 'Igor Matos', turma: quarta, data: aulasPassadas(quarta, hoje, 1, config)[0] },
    { aluno: 'Paula Teles', turma: sabado, data: aulasPassadas(sabado, hoje, 1, config)[0] },
  ];
  for (const f of pendentes) {
    if (f.data) d({ type: 'ADD_FALTA', alunoNome: f.aluno, turmaId: f.turma.id, datasComTipo: [{ data: f.data, semAntecedencia: false }] });
  }

  // Faltas futuras de alunos das turmas com vaga: abrem vaga para a Marina repor
  // (além das vagas extras das cadeiras livres).
  const proxima = (turma, n = 0) => getNextOccurrences(turma, 6).filter((x) => !isDataBloqueada(x, config))[n];
  d({ type: 'ADD_FALTA', alunoNome: 'Helena Reis', turmaId: quarta.id, datasComTipo: [{ data: proxima(quarta), semAntecedencia: false }] });
  d({ type: 'ADD_FALTA', alunoNome: 'Nina Alves', turmaId: sabado.id, datasComTipo: [{ data: proxima(sabado), semAntecedencia: false }] });

  // Uma reposição já marcada (aparece no Resumo como quem vem repor) e férias
  // de um aluno neste mês.
  const faltaCarla = proxima(terca, 1);
  d({ type: 'ADD_FALTA', alunoNome: 'Carla Dias', turmaId: terca.id, datasComTipo: [{ data: faltaCarla, semAntecedencia: false }] });
  const vagaSab = s.vagas.find((v) => v.turmaId === sabado.id);
  if (vagaSab) {
    d({ type: 'ADD_REPOSICAO', alunoNome: 'Carla Dias', turmaOrigemId: terca.id, turmaReposicaoId: sabado.id, dataReposicao: vagaSab.data, vagaSelId: vagaSab.id, semVagaOficial: false });
  }
  d({ type: 'ADD_AUSENCIA', alunoNome: 'Zeca Ramos', turmaId: quinta.id, mesAno: dateToStr(hoje).slice(0, 7) });

  // Link da protagonista.
  d({ type: 'GERAR_ACESSO', alunoNome: PROTAGONISTA, turmaId: terca.id });
  const codigoMarina = arr(s.acessos).find((a) => a.alunoNome === PROTAGONISTA).codigo;

  return {
    state: { ...s, _updatedAt: hoje.getTime() },
    config: { ...config, criadoEm: hoje.toISOString() },
    publico: { nome: 'Ateliê Barro Bom', artigo: 'o', cor: '#b45309' },
    codigoMarina,
  };
}
