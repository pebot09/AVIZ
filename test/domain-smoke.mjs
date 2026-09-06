import { reducer, normalizeState, EMPTY_STATE } from '../src/domain/reducer.js';
import { computeResumoDia } from '../src/domain/resumo.js';
import { construirDados } from '../src/domain/painel.js';
import { todayStr, dateToStr, TURMA_EXTRA_ID, turmaShortLabel } from '../src/domain/helpers.js';
import { getNextOccurrences, horarioNaData } from '../src/domain/calendario.js';

const config = {
  regras: { capacidadeNominal: 7, capacidadeFisica: 8, validadeFaltaDias: 30, validadeFeriasDias: 30, antecedenciaHoras: 2, semAntecedencia: true },
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

console.log('\n✅ smoke test passou');
