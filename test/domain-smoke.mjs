import { reducer, normalizeState, EMPTY_STATE } from '../src/domain/reducer.js';
import { computeResumoDia } from '../src/domain/resumo.js';
import { construirDados } from '../src/domain/painel.js';
import { todayStr, dateToStr, TURMA_EXTRA_ID, turmaShortLabel, turmaEncontros } from '../src/domain/helpers.js';
import { getNextOccurrences, horarioNaData, getClassDatetime, isDataBloqueada } from '../src/domain/calendario.js';
import { fatiaAluno } from '../src/domain/fatiaAluno.js';
import { primeirosPassos, guiaConcluido } from '../src/domain/primeirosPassos.js';

// console.assert só imprime; aqui uma falha tem que derrubar o teste (e o deploy).
const _assert = console.assert;
console.assert = (cond, ...msg) => { if (!cond) { _assert(cond, ...msg); process.exitCode = 1; } };

const config = {
  regras: { capacidadeNominal: 7, capacidadeFisica: 8, validadeFaltaDias: 30, validadeFeriasDias: 30, antecedenciaHoras: 2, semAntecedencia: true, ferias: true, feriasCredito: true, feriasCreditos: 1, feriasLimiteAno: 0 },
  calendario: { recessos: [], feriadosMunicipais: [], feriadosIgnorados: [] },
  vocab: {},
};
const autor = 'Ana';
let s = normalizeState({});
const d = (a, extra = {}) => { s = reducer(s, { ...a, ...extra }, config, autor); };

// turma de dois dias (ter/qui 09h), como o caso do yoga
d({ type: 'ADD_TURMA', encontros: [
  { diaSemana: 'terça', hora: 9, minuto: 0 },
  { diaSemana: 'quinta', hora: 9, minuto: 0 },
], capacidade: 7 });
const turma = s.turmas.find(t => t.id !== TURMA_EXTRA_ID);
console.log('turma:', turmaShortLabel(turma));
console.assert(turmaShortLabel(turma) === 'Ter/Qui 09h', 'label multi-dia errado');

d({ type: 'ADD_ALUNO', turmaId: turma.id, nome: 'Bia' });
d({ type: 'ADD_ALUNO', turmaId: turma.id, nome: 'Caio' });

const proximas = getNextOccurrences(turma, 4);
console.log('próximas 4 datas:', proximas.join(' '));
console.assert(proximas.length === 4, 'devia gerar 4 datas');

// falta da Bia na próxima data
d({ type: 'ADD_FALTA', alunoNome: 'Bia', turmaId: turma.id, datasComTipo: [{ data: proximas[0], semAntecedencia: false }] });
console.log('faltas:', s.faltas.length, '| vagas:', s.vagas.length);
console.assert(s.faltas.length === 1, 'falta não criada');

// notas, acesso
d({ type: 'ADD_NOTA', turmaId: turma.id, texto: 'trazer tapete' });
d({ type: 'GERAR_ACESSO', alunoNome: 'Bia', turmaId: turma.id });
console.log('nota:', s.notas[0].texto, '| código:', s.acessos[0].codigo);
console.assert(/^\d{6}$/.test(s.acessos[0].codigo), 'código inválido');

// painel: derivação + observações
const td = todayStr();
const in7 = (() => { const x = new Date(); x.setDate(x.getDate()+7); return dateToStr(x); })();
const d2 = (() => { const x = new Date(); x.setDate(x.getDate()-2); return dateToStr(x); })();
const dados = construirDados(s, config, td, in7, d2);
console.log('painel → faltas:', dados.combined.length, '| repos:', dados.reposAtivas.length, '| vagas:', dados.vagasGrupos.length, '| obs:', dados.obs.length);
console.assert(dados.combined.length === 1, 'painel devia listar 1 falta');

// resumo do dia na data da falta
const resumo = computeResumoDia(s, proximas[0], config);
console.log('resumo:', JSON.stringify(resumo.map(r => ({ t: turmaShortLabel(s.turmas.find(x=>x.id===r.turmaId)), pres: r.presentes, falt: r.faltaram }))));
console.assert(resumo.length === 1 && resumo[0].faltaram.includes('Bia'), 'resumo errado');
console.assert(resumo[0].presentes.includes('Caio'), 'Caio devia estar presente');

// horário depende do dia (turma com horários diferentes)
d({ type: 'ADD_TURMA', encontros: [
  { diaSemana: 'segunda', hora: 9, minuto: 0 },
  { diaSemana: 'quarta', hora: 19, minuto: 30 },
], capacidade: 7 });
const t2 = s.turmas.filter(t => t.id !== TURMA_EXTRA_ID)[1];
console.log('turma 2:', turmaShortLabel(t2));
const seg = getNextOccurrences(t2, 2);
console.log('horários:', seg.map(x => `${x}=${horarioNaData(t2.id, x, s.turmas)}`).join(' '));

// cancelar aula gera falta com cancelamentoId
d({ type: 'CANCEL_AULA', turmaId: turma.id, data: proximas[1] });
const geradas = s.faltas.filter(f => f.cancelamentoId);
console.log('faltas de aula cancelada:', geradas.length, '| têm cancelamentoId:', geradas.every(f => !!f.cancelamentoId));
console.assert(geradas.length > 0, 'cancelar aula devia gerar faltas');

// congelar resumos: escola nova não deve congelar dia nenhum (seria histórico
// inventado, já que o resumo sai da lista de alunos de hoje)
d({ type: 'FREEZE_RESUMOS' });
console.log('resumosDiarios (escola nova):', Object.keys(s.resumosDiarios).length);
console.assert(Object.keys(s.resumosDiarios).length === 0, 'escola nova não devia congelar nada');

// já uma escola com histórico congela normalmente
const ontem10 = (() => { const x = new Date(); x.setDate(x.getDate() - 10); return x.toISOString(); })();
s = { ...s, log: [...s.log, { id: 'log-antigo', ts: ontem10, professor: 'Ana', descricao: 'uso antigo' }] };
d({ type: 'FREEZE_RESUMOS' });
const nCong = Object.keys(s.resumosDiarios).length;
console.log('resumosDiarios (com histórico de 10 dias):', nCong);
console.assert(nCong > 0, 'escola com histórico devia congelar dias passados');
d({ type: 'SAVE_SNAPSHOT', label: 'teste', dados: { faltas: [], turmas: [] } });
console.log('snapshots:', s.snapshots.length, s.snapshots[0].label);

// excluir turma limpa notas e acessos
d({ type: 'REMOVE_ALUNO', turmaId: turma.id, nome: 'Bia' });
console.log('acessos após remover Bia:', s.acessos.length);
console.assert(s.acessos.length === 0, 'acesso devia ser revogado');

// --- resumo do dia mostra quem está de férias ---
// Nina é nova e sem faltas — assim as férias não esbarram na trava
// "férias com falta no mesmo mês" (testada logo abaixo).
const mesAtual = todayStr().slice(0, 7);
d({ type: 'ADD_ALUNO', turmaId: turma.id, nome: 'Nina' });
d({ type: 'ADD_AUSENCIA', alunoNome: 'Nina', turmaId: turma.id, mesAno: mesAtual });
const dataResumo = proximas.find(x => x.slice(0, 7) === mesAtual);
if (dataResumo) {
  const r2 = computeResumoDia(s, dataResumo, config)[0];
  console.log('resumo com férias → presentes:', r2.presentes, '| férias:', r2.ferias);
  console.assert(r2.ferias.includes('Nina'), 'Nina de férias devia aparecer no resumo');
  console.assert(!r2.presentes.includes('Nina'), 'quem está de férias não é presente');
}

// --- turma sem dia (extra) não inventa horário ---
{
  const extra = s.turmas.find(t => t.id === TURMA_EXTRA_ID);
  console.assert(turmaEncontros(extra).length === 0, 'turma extra não devia ter encontro');
  console.assert(getClassDatetime(TURMA_EXTRA_ID, '2026-09-10', s.turmas) === null, 'extra não devia ter horário de aula');
  console.log('turma extra: encontros=%d datetime=%s label=%s',
    turmaEncontros(extra).length, getClassDatetime(TURMA_EXTRA_ID, '2026-09-10', s.turmas), turmaShortLabel(extra));
}

// --- turma no formato antigo (antes dos encontros) continua funcionando ---
{
  const antiga = { id: 't-velha', diaSemana: 'terça', hora: 9, minuto: 0, horario: '09h', alunos: [] };
  console.assert(turmaShortLabel(antiga) === 'Ter 09h', 'label da turma antiga quebrou');
  console.assert(!!getClassDatetime('t-velha', '2026-09-08', [antiga]), 'datetime da turma antiga quebrou');
  console.log('turma antiga migra sozinha:', turmaShortLabel(antiga));
}

// --- férias travada quando há falta no mesmo mês (bug do Carlos) ---
{
  let s2 = normalizeState({});
  const dd = (a) => { s2 = reducer(s2, a, config, 'Prof'); };
  dd({ type: 'ADD_TURMA', encontros: [{ diaSemana: 'quarta', hora: 9, minuto: 0 }], capacidade: 7 });
  const tq = s2.turmas.find(t => t.id !== TURMA_EXTRA_ID);
  dd({ type: 'ADD_ALUNO', turmaId: tq.id, nome: 'Carlos' });
  const dataQua = getNextOccurrences(tq, 8).find(x => !isDataBloqueada(x, config));
  const mes = dataQua.slice(0, 7);
  dd({ type: 'ADD_FALTA', alunoNome: 'Carlos', turmaId: tq.id, datasComTipo: [{ data: dataQua, semAntecedencia: false }] });
  const vagasAntes = s2.vagas.length;
  const ausAntes = s2.ausencias.length;
  dd({ type: 'ADD_AUSENCIA', alunoNome: 'Carlos', turmaId: tq.id, tipo: 'ferias', mesAno: mes });
  console.log('férias com falta no mês → ausencias:', s2.ausencias.length, '(esperado', ausAntes + ')');
  console.assert(s2.ausencias.length === ausAntes, 'férias NÃO devia ter sido criada com falta no mês');
  console.assert(s2.vagas.length === vagasAntes, 'férias bloqueada não devia abrir vagas');
  // cancelando a falta, aí sim as férias entram
  const f = s2.faltas.find(x => x.alunoNome === 'Carlos');
  dd({ type: 'CANCEL_FALTA', id: f.id });
  dd({ type: 'ADD_AUSENCIA', alunoNome: 'Carlos', turmaId: tq.id, tipo: 'ferias', mesAno: mes });
  console.assert(s2.ausencias.length === ausAntes + 1, 'sem a falta, as férias deviam entrar');
  console.log('após cancelar a falta, férias entram: ok');
}

// --- log antigo com "-feira" é limpo no load (migração de exibição) ---
{
  const sujo = normalizeState({
    log: [
      { id: 'l1', ts: '2026-01-01T10:00:00Z', professor: 'Ana', descricao: 'Criou turma Segunda-feira e Quarta-feira 09h' },
      { id: 'l2', ts: '2026-01-01T10:01:00Z', professor: 'Ana', descricao: 'Feriado: Sexta-feira Santa' },
    ],
  });
  console.log('log limpo:', JSON.stringify(sujo.log.map((e) => e.descricao)));
  console.assert(sujo.log[0].descricao === 'Criou turma Segunda e Quarta 09h', 'log antigo devia perder "-feira"');
  console.assert(sujo.log[1].descricao === 'Feriado: Sexta-feira Santa', 'nome de feriado não devia mudar');
}

// --- ciclo falta→reposição fecha quando as datas passam (bug do card do aluno) ---
// Cenário real: hoje é 13/10. Falta de 15/09 com reposição em 30/09 (já passou)
// deve sumir; falta de 29/09 com reposição em 14/10 (ainda não) deve ficar.
{
  const ontem = '2026-09-30', amanha = '2999-01-01'; // uma passou, a outra é futura
  const bruto = {
    turmas: [{ id: 't1', diaSemana: 'quarta', hora: 9, minuto: 0, alunos: ['Bia'] }],
    faltas: [
      { id: 'fA', alunoNome: 'Bia', turmaId: 't1', datas: ['2026-09-15'], status: 'marcada', reposicaoId: 'rA' },
      { id: 'fB', alunoNome: 'Bia', turmaId: 't1', datas: ['2026-09-29'], status: 'marcada', reposicaoId: 'rB' },
    ],
    reposicoes: [
      { id: 'rA', alunoNome: 'Bia', faltaId: 'fA', dataReposicao: ontem, turmaReposicaoId: 't1', tipo: 'reposicao', realizada: false },
      { id: 'rB', alunoNome: 'Bia', faltaId: 'fB', dataReposicao: amanha, turmaReposicaoId: 't1', tipo: 'reposicao', realizada: false },
    ],
  };
  const lim = normalizeState(bruto);
  const ids = lim.faltas.map((f) => f.id);
  console.log('faltas após fechar ciclo:', JSON.stringify(ids), '| rA realizada:', lim.reposicoes.find((r) => r.id === 'rA').realizada);
  console.assert(!ids.includes('fA'), 'falta com reposição já passada devia sumir');
  console.assert(ids.includes('fB'), 'falta com reposição futura devia ficar');
  console.assert(lim.reposicoes.find((r) => r.id === 'rA').realizada === true, 'reposição passada vira realizada');
  console.assert(lim.reposicoes.find((r) => r.id === 'rB').realizada !== true, 'reposição futura não é realizada');
}

// --- falta pendente expira depois do prazo e avisa no log (como no original) ---
{
  // validadeFaltaDias: 30. Falta pendente de ~40 dias atrás deve expirar; uma
  // recente não. A falta "velha" sai da lista, entra na estatística e no log.
  const d40 = (() => { const x = new Date(); x.setDate(x.getDate() - 40); return dateToStr(x); })();
  const d5 = (() => { const x = new Date(); x.setDate(x.getDate() - 5); return dateToStr(x); })();
  const bruto = {
    turmas: [{ id: 'tq', diaSemana: 'quarta', hora: 9, minuto: 0, alunos: ['Rui'] }],
    faltas: [
      { id: 'velha', alunoNome: 'Rui', turmaId: 'tq', datas: [d40], status: 'pendente' },
      { id: 'nova', alunoNome: 'Rui', turmaId: 'tq', datas: [d5], status: 'pendente' },
    ],
    vagas: [{ id: 'v-velha', turmaId: 'tq', data: d40, faltaId: 'velha' }],
  };
  let sx = normalizeState(bruto);
  sx = reducer(sx, { type: 'CLEANUP' }, config, 'Ana');
  const ids = sx.faltas.map((f) => f.id);
  console.log('após CLEANUP → faltas:', JSON.stringify(ids), '| expiradas:', sx.estatisticas.faltasExpiradas.length, '| log[0]:', sx.log[0] && sx.log[0].descricao);
  console.assert(!ids.includes('velha'), 'falta pendente vencida devia expirar');
  console.assert(ids.includes('nova'), 'falta pendente dentro do prazo devia ficar');
  console.assert(sx.estatisticas.faltasExpiradas.some((e) => e.alunoNome === 'Rui'), 'expiração devia entrar na estatística');
  console.assert(sx.log.some((e) => e.origem === 'sistema' && /Expirou/.test(e.descricao)), 'expiração devia avisar no log');
  console.assert(!sx.vagas.some((v) => v.faltaId === 'velha'), 'vaga da falta expirada devia fechar');
  // a fatia do aluno não mostra a falta vencida nem antes do CLEANUP
  const fatiaX = fatiaAluno(normalizeState(bruto), config, { alunoNome: 'Rui', turmaId: 'tq' });
  console.assert(!fatiaX.faltas.some((f) => f.id === 'velha'), 'aluno não devia ver falta vencida');
  console.assert(fatiaX.faltas.some((f) => f.id === 'nova'), 'aluno devia ver a falta no prazo');
}

// --- guia de primeiros passos ---
{
  const feito = (st, m) => Object.fromEntries(primeirosPassos(st, m).map((p) => [p.key, p.feito]));
  let g = normalizeState({});
  const gd = (a) => { g = reducer(g, a, config, autor); };
  const vazio = feito(g, {});
  console.assert(!vazio.regras && !vazio.turmas && !vazio.alunos && !vazio.link && !vazio.professores, 'escola nova: nada feito');
  console.assert(!guiaConcluido(primeirosPassos(g, {})), 'escola nova: guia aparece');
  gd({ type: 'ADD_TURMA', encontros: [{ diaSemana: 'segunda', hora: 9, minuto: 0 }], capacidade: 5 });
  const tg = g.turmas.find((t) => t.id !== TURMA_EXTRA_ID);
  console.assert(feito(g, {}).turmas && !feito(g, {}).alunos, 'turma criada conta; sem aluno ainda');
  gd({ type: 'ADD_ALUNO', turmaId: tg.id, nome: 'Lia' });
  console.assert(feito(g, {}).alunos && !feito(g, {}).link, 'aluno conta; link ainda não');
  gd({ type: 'GERAR_ACESSO', alunoNome: 'Lia', turmaId: tg.id });
  console.assert(feito(g, {}).link, 'link gerado conta');
  console.assert(!guiaConcluido(primeirosPassos(g, {})), 'sem conferir regras o guia continua');
  console.assert(guiaConcluido(primeirosPassos(g, { regras: true })), 'professores é opcional: guia conclui sem ele');
  console.log('primeiros passos ok');
}

console.log(process.exitCode ? '\n❌ smoke test falhou' : '\n✅ smoke test passou');
