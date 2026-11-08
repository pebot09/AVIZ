// Dados do tutorial: a escola fictícia "Ateliê Barro Bom" (a mesma do vídeo,
// scripts/escolaDemo.js), com um pouco mais de vida para as capturas: notas
// da turma, crédito extra, aula extra, foto da lista, ações de professores e
// da própria aluna, e uma escola vazia para o guia de primeiros passos.
//
// Monta a árvore inteira do banco de mentira (firebase-falso.js).

import { montarEscolaDemo, PROTAGONISTA } from '../escolaDemo.js';
import { reducer, normalizeState } from '../../src/domain/reducer.js';
import { arr, dateToStr, TURMA_EXTRA_ID } from '../../src/domain/helpers.js';
import { getNextOccurrences, isDataBloqueada } from '../../src/domain/calendario.js';
import { acaoDoAluno } from '../../src/domain/fatiaAluno.js';
import { snapshotFromState } from '../../src/components/Snapshots.jsx';

export const ESCOLA = 'atelie-barro-bom';
export const ESCOLA_NOVA = 'atelie-novo';
export const CODIGO_MARINA = '482913';
export const DONA = { uid: 'dona', nome: 'Marta', email: 'marta@barrobom.com.br' };
export const PROFS = [
  { uid: 'prof-ana', nome: 'Ana Lúcia', email: 'ana@barrobom.com.br' },
  { uid: 'prof-rui', nome: 'Rui', email: 'rui@barrobom.com.br' },
];

const diasAtras = (hoje, n) => { const d = new Date(hoje); d.setDate(d.getDate() - n); return dateToStr(d); };
const emDias = (hoje, n) => { const d = new Date(hoje); d.setDate(d.getDate() + n); return dateToStr(d); };

function aulaPassadaEntre(turma, hoje, de, ate, config) {
  for (let i = de; i <= ate; i++) {
    const s = diasAtras(hoje, i);
    const dias = { domingo: 0, segunda: 1, terça: 2, quarta: 3, quinta: 4, sexta: 5, sábado: 6 };
    const d = new Date(s + 'T12:00:00');
    if (d.getDay() === dias[turma.encontros[0].diaSemana] && !isDataBloqueada(s, config)) return s;
  }
  return null;
}

// Horários plausíveis (8h às 21h), do mais novo para trás.
function horariosDeTrabalho(log, hoje) {
  const t = new Date(hoje);
  t.setHours(Math.min(Math.max(t.getHours(), 9), 20), 12, 0, 0);
  return log.map((e, i) => {
    t.setMinutes(t.getMinutes() - (150 + ((i * 47) % 140)));
    if (t.getHours() < 8) { t.setDate(t.getDate() - 1); t.setHours(20, 40 - i, 0, 0); }
    return { ...e, ts: t.toISOString() };
  });
}

export function montarCenario(hoje = new Date()) {
  const base = montarEscolaDemo(hoje);
  const config = base.config;
  let s = normalizeState(base.state);
  // A demo do vídeo grava tudo como "Equipe": aqui quem fez foi a dona.
  const trocaAutor = (x) => (x === 'Equipe' ? DONA.nome : x);
  s = {
    ...s,
    log: s.log.map((e) => ({ ...e, professor: trocaAutor(e.professor) })),
    faltas: s.faltas.map((f) => ({ ...f, criadoPor: trocaAutor(f.criadoPor) })),
    reposicoes: s.reposicoes.map((r) => ({ ...r, criadoPor: trocaAutor(r.criadoPor) })),
  };

  const d = (acao, autor = DONA.nome) => { s = reducer(s, { autor, ...acao }, config); };
  const turmas = s.turmas.filter((t) => t.id !== TURMA_EXTRA_ID);
  const [terca, quarta, sabado, quinta] = turmas;
  // Código fixo: o link da Marina precisa ser o mesmo em toda abertura.
  s = { ...s, acessos: s.acessos.map((a) => (a.alunoNome === PROTAGONISTA ? { ...a, codigo: CODIGO_MARINA } : a)) };
  const acessoMarina = arr(s.acessos).find((a) => a.alunoNome === PROTAGONISTA);
  const doAluno = (pedido) => {
    const r = acaoDoAluno(pedido, acessoMarina, s, config);
    if (r.ok) s = reducer(s, r.acao, config);
  };

  // Marina: uma falta antiga perto de vencer (feita pela professora)…
  const antiga = aulaPassadaEntre(terca, hoje, 23, 29, config);
  if (antiga) d({ type: 'ADD_FALTA', alunoNome: PROTAGONISTA, turmaId: terca.id, datasComTipo: [{ data: antiga, semAntecedencia: false }] }, PROFS[0].nome);
  // …e uma recente, avisada por ela mesma pelo link, já com reposição marcada.
  const recente = aulaPassadaEntre(terca, hoje, 1, 7, config);
  if (recente) doAluno({ type: 'ADD_FALTA', datasComTipo: [{ data: recente, semAntecedencia: false }] });
  const faltaRecente = s.faltas.find((f) => f.alunoNome === PROTAGONISTA && f.datas[0] === recente);
  const vagaQuarta = s.vagas.find((v) => v.turmaId === quarta.id && v.data >= dateToStr(hoje) && v.faltaId);
  if (faltaRecente && vagaQuarta) {
    doAluno({ type: 'ADD_REPOSICAO', dataReposicao: vagaQuarta.data, turmaReposicaoId: quarta.id, semVagaOficial: false, vagaSelId: vagaQuarta.id, faltaId: faltaRecente.id, tipo: 'reposicao' });
  }
  // Crédito extra para a Marina (dado pela dona).
  d({ type: 'ADD_CREDITO', alunoNome: PROTAGONISTA, turmaId: terca.id, dataExpiracao: emDias(hoje, 30) });

  // Aula extra (paga à parte) de uma aluna da quinta, no sábado.
  const vagaSab = s.vagas.find((v) => v.turmaId === sabado.id && v.data >= dateToStr(hoje));
  const sabProx = getNextOccurrences(sabado, 4).find((x) => !isDataBloqueada(x, config));
  d({ type: 'ADD_REPOSICAO', alunoNome: 'Alice Gomes', turmaOrigemId: quinta.id, turmaReposicaoId: sabado.id, dataReposicao: vagaSab ? vagaSab.data : sabProx, vagaSelId: vagaSab ? vagaSab.id : null, semVagaOficial: !vagaSab, tipo: 'aula_extra' }, PROFS[1].nome);

  // Uma falta registrada pelo Rui na quinta, para o registro ter cores.
  const quintaProx = getNextOccurrences(quinta, 4).find((x) => !isDataBloqueada(x, config));
  d({ type: 'ADD_FALTA', alunoNome: 'Wagner Dutra', turmaId: quinta.id, datasComTipo: [{ data: quintaProx, semAntecedencia: false }] }, PROFS[1].nome);

  // Notas da turma de terça.
  d({ type: 'ADD_NOTA', turmaId: terca.id, texto: 'Forno cheio nesta semana: as peças de terça só saem na próxima aula.' }, DONA.nome);
  d({ type: 'ADD_NOTA', turmaId: terca.id, texto: 'Acabou o barro vermelho. Usei o branco com a turma hoje.' }, PROFS[0].nome);

  // Aluno na turma "extras & ex-alunos".
  d({ type: 'ADD_ALUNO', turmaId: TURMA_EXTRA_ID, nome: 'Renata Borges' });

  // Datas e horas espalhadas nos últimos dias (tudo foi criado "agora").
  const agora = hoje.getTime();
  s = {
    ...s,
    log: horariosDeTrabalho(s.log, hoje),
    notas: s.notas.map((n, i) => ({ ...n, ts: new Date(agora - (i === 0 ? 30 : 4) * 3600 * 1000).toISOString() })),
  };

  // Uma foto da lista salva.
  s = reducer(s, { type: 'SAVE_SNAPSHOT', label: 'Fechamento da semana', dados: snapshotFromState(s, config), autor: DONA.nome }, config);
  s = { ...s, snapshots: s.snapshots.map((x) => ({ ...x, ts: new Date(agora - 50 * 3600 * 1000).toISOString() })) };

  const membros = {
    [DONA.uid]: { role: 'owner', nome: DONA.nome, email: DONA.email },
    ...Object.fromEntries(PROFS.map((p) => [p.uid, { role: 'professor', nome: p.nome, email: p.email }])),
  };
  const pub = base.publico;

  return {
    codigoMarina: acessoMarina.codigo,
    banco: {
      tenantsPublic: { [ESCOLA]: pub, [ESCOLA_NOVA]: pub },
      tenants: {
        [ESCOLA]: { config, state: { ...s, _updatedAt: agora }, members: membros },
        [ESCOLA_NOVA]: { config, members: { [DONA.uid]: membros[DONA.uid] } },
      },
    },
  };
}
