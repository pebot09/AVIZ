// Fatia do aluno.
//
// O ponto crítico é o vazamento: no Passarinho o navegador do aluno tinha o
// banco inteiro. Aqui ele só pode receber o que é dele. Este teste monta uma
// escola com dois alunos e varre a fatia inteira atrás do nome do outro.

import { reducer, normalizeState } from '../src/domain/reducer.js';
import {
  fatiaAluno, getCancelFaltaStatus, statusDataFalta, faixaCancelamentoRepo,
  vagasParaAluno, mesesDeFeriasDisponiveis, acaoDoAluno,
} from '../src/domain/fatiaAluno.js';
import { todayStr, TURMA_EXTRA_ID } from '../src/domain/helpers.js';
import { getNextOccurrences, isDataBloqueada, getClassDatetime } from '../src/domain/calendario.js';

const config = {
  regras: {
    capacidadeNominal: 7, capacidadeFisica: 8, validadeFaltaDias: 30,
    antecedenciaHoras: 22, semAntecedencia: true, semAntecedenciaJanela: 2,
    vagaExtra: true, vagaExtraAbertura: 'vespera',
    ferias: true, feriasCredito: true, feriasCreditos: 1, feriasValidadeDias: 30, feriasLimiteAno: 1,
  },
  calendario: { recessos: [], feriadosMunicipais: [], feriadosIgnorados: [] },
  vocab: {},
};

let falhas = 0;
const checar = (nome, cond, extra) => {
  if (cond) console.log(`  ok  ${nome}`);
  else { console.log(`  ERRO ${nome}${extra ? ' — ' + extra : ''}`); falhas++; }
};

let s = normalizeState({});
const d = (a) => { s = reducer(s, a, config, 'Professora'); };

// Duas turmas, dois alunos com nomes bem distintos.
d({ type: 'ADD_TURMA', encontros: [{ diaSemana: 'terça', hora: 9, minuto: 0 }], capacidade: 7 });
d({ type: 'ADD_TURMA', encontros: [{ diaSemana: 'quinta', hora: 19, minuto: 30 }], capacidade: 7 });
const [t1, t2] = s.turmas.filter((t) => t.id !== TURMA_EXTRA_ID);
d({ type: 'ADD_ALUNO', turmaId: t1.id, nome: 'Anaquerida' });
d({ type: 'ADD_ALUNO', turmaId: t1.id, nome: 'Zoroastro' });
d({ type: 'ADD_ALUNO', turmaId: t2.id, nome: 'Belquior' });

const prox1 = getNextOccurrences(t1, 8).filter((x) => !isDataBloqueada(x, config));
const prox2 = getNextOccurrences(t2, 8).filter((x) => !isDataBloqueada(x, config));

// O outro aluno falta (abre vaga) e tem férias — nada disso pode aparecer.
d({ type: 'ADD_FALTA', alunoNome: 'Zoroastro', turmaId: t1.id, datasComTipo: [{ data: prox1[0], semAntecedencia: false }] });
d({ type: 'ADD_FALTA', alunoNome: 'Belquior', turmaId: t2.id, datasComTipo: [{ data: prox2[0], semAntecedencia: false }] });
d({ type: 'ADD_NOTA', turmaId: t1.id, texto: 'Zoroastro anda sumido' });
d({ type: 'GERAR_ACESSO', alunoNome: 'Anaquerida', turmaId: t1.id });
d({ type: 'GERAR_ACESSO', alunoNome: 'Zoroastro', turmaId: t1.id });

// A nossa aluna falta e tira férias.
d({ type: 'ADD_FALTA', alunoNome: 'Anaquerida', turmaId: t1.id, datasComTipo: [{ data: prox1[1], semAntecedencia: false }] });
d({ type: 'ADD_AUSENCIA', alunoNome: 'Anaquerida', turmaId: t1.id, mesAno: todayStr().slice(0, 7) });

const acesso = { alunoNome: 'Anaquerida', turmaId: t1.id };
const fatia = fatiaAluno(s, config, acesso);

// ---- privacidade ----
const texto = JSON.stringify(fatia);
checar('fatia não vaza o nome de outro aluno da mesma turma', !texto.includes('Zoroastro'));
checar('fatia não vaza o nome de aluno de outra turma', !texto.includes('Belquior'));
checar('fatia não traz notas da escola', !texto.includes('anda sumido'));
checar('fatia não traz o log', !('log' in fatia));
checar('fatia não traz a lista de alunos das turmas', !fatia.turmas.some((t) => 'alunos' in t));
checar('fatia não traz os acessos (códigos) de ninguém', !('acessos' in fatia));
checar('vaga de outro aluno não carrega o faltaId dele', fatia.vagas.every((v) => !('faltaId' in v)));

// ---- o que ela precisa ver ----
checar('fatia traz as faltas dela', fatia.faltas.length === 1 && fatia.faltas[0].alunoNome === 'Anaquerida');
checar('fatia traz as férias dela', fatia.ausencias.length === 1);
checar('fatia traz vagas para escolher', fatia.vagas.length > 0);
checar('fatia marca a vaga das próprias férias', fatia.vagas.some((v) => v.ausenciaId));
checar('rótulo da turma vem pronto', fatia.turmaCurta === 'Ter 09h', fatia.turmaCurta);

// ---- travas de cancelar falta ----
const minhaFalta = fatia.faltas[0];
checar('pode cancelar falta comum futura', getCancelFaltaStatus(minhaFalta, fatia, config).pode);

const marcada = { ...minhaFalta, status: 'marcada' };
checar('não cancela falta com reposição marcada', !getCancelFaltaStatus(marcada, fatia, config).pode);

const deCancelamento = { ...minhaFalta, cancelamentoId: 'canc-1' };
const rc = getCancelFaltaStatus(deCancelamento, fatia, config);
checar('não cancela falta de aula cancelada', !rc.pode && /aula cancelada/i.test(rc.motivo), rc.motivo);

const passada = { ...minhaFalta, datas: ['2020-01-07'] };
checar('não cancela falta cuja aula já passou', !getCancelFaltaStatus(passada, fatia, config).pode);

const semVaga = { ...fatia, vagas: [] };
checar('não cancela se a vaga foi ocupada e não há outra', !getCancelFaltaStatus(minhaFalta, semVaga, config).pode);

// ---- janelas de antecedência (config: 22h comum, 2h de janela) ----
const H = 3600000;
const dataAlvo = prox1[2];
const inicio = getClassDatetime(t1.id, dataAlvo, fatia.turmas).getTime();
checar('falta comum bem antes da aula', statusDataFalta(t1.id, dataAlvo, fatia, config, inicio - 30 * H) === 'normal');
checar('vira sem antecedência dentro do prazo', statusDataFalta(t1.id, dataAlvo, fatia, config, inicio - 10 * H) === 'semAntecedencia');
checar('encerrado dentro da janela final', statusDataFalta(t1.id, dataAlvo, fatia, config, inicio - 1 * H) === 'encerrado');
checar('encerrado depois de começar', statusDataFalta(t1.id, dataAlvo, fatia, config, inicio + 1 * H) === 'encerrado');

// ---- faixas de cancelamento da reposição ----
const repoFake = { turmaReposicaoId: t1.id, dataReposicao: dataAlvo };
checar('cancelar cedo devolve o direito', faixaCancelamentoRepo(repoFake, fatia, config, inicio - 48 * H) === 'devolve');
checar('cancelar em cima volta como sem antecedência', faixaCancelamentoRepo(repoFake, fatia, config, inicio - 10 * H) === 'semAntecedencia');
checar('cancelar na última hora não devolve nada', faixaCancelamentoRepo(repoFake, fatia, config, inicio - 1 * H) === 'semCredito');

// ---- vagas oferecidas ----
const vagas = vagasParaAluno(fatia);
const chaves = vagas.map((v) => `${v.data}|${v.turmaId}`);
checar('uma vaga por turma+data', new Set(chaves).size === chaves.length);
// O reducer recusa reposição na própria turma. Se a vaga aparecesse, o aluno
// clicaria num botão que não faz nada — nem sucesso, nem erro.
checar('não oferece vaga da própria turma do aluno', vagas.every((v) => v.turmaId !== t1.id));
checar('oferece vagas de outras turmas', vagas.some((v) => v.turmaId === t2.id));
// Aula cancelada não recebe reposição.
{
  const dataCanc = vagas[0] && vagas[0].data;
  const comCancelada = { ...fatia, aulasCanceladas: [{ turmaId: t2.id, data: dataCanc }] };
  checar('não oferece vaga de aula cancelada',
    !vagasParaAluno(comCancelada).some((v) => v.turmaId === t2.id && v.data === dataCanc));
}

// ---- férias ----
const meses = mesesDeFeriasDisponiveis(fatia, config);
checar('limite de férias por ano é respeitado', meses.every((m) => m.slice(0, 4) !== todayStr().slice(0, 4)), meses.join(','));

// ---- ações: identidade vem do código, não do pedido ----
const forjada = acaoDoAluno({ type: 'ADD_FALTA', alunoNome: 'Zoroastro', turmaId: t2.id, datasComTipo: [] }, acesso, s, config);
checar('ação forjada é reescrita com a identidade do código',
  forjada.ok && forjada.acao.alunoNome === 'Anaquerida' && forjada.acao.turmaId === t1.id);

const faltaDoOutro = s.faltas.find((f) => f.alunoNome === 'Zoroastro');
const rr = acaoDoAluno({ type: 'CANCEL_FALTA', id: faltaDoOutro.id }, acesso, s, config);
checar('não cancela falta de outro aluno', !rr.ok, rr.erro);

// ---- autoria no histórico ----
// O reducer lê action.autor. Se a ação do aluno não carimbar isso, o registro
// entra no histórico da escola como "?" — o professor não saberia quem agiu.
{
  const a = acaoDoAluno({ type: 'ADD_FALTA', datasComTipo: [{ data: prox1[3], semAntecedencia: false }] }, acesso, s, config);
  const depois = reducer(s, a.acao, config);
  const entrada = depois.log[0];
  checar('ação do aluno entra no histórico com o nome dele', entrada && entrada.professor === 'Anaquerida',
    entrada && entrada.professor);
  checar('ação do aluno é marcada como origem aluno', entrada && entrada.origem === 'aluno');
}

// ---- watchlist (avisos de vaga) ----
{
  const w = acaoDoAluno({ type: 'SET_ALUNO_WATCHLIST', watchlist: [t2.id, 'turma-que-nao-existe'] }, acesso, s, config);
  checar('watchlist é aceita como ação do aluno', w.ok);
  const depois = reducer(s, w.acao, config, 'Anaquerida');
  const meuAcesso = depois.acessos.find((a) => a.alunoNome === 'Anaquerida' && a.turmaId === t1.id);
  checar('watchlist é gravada no acesso do aluno', meuAcesso && meuAcesso.watchlist.includes(t2.id),
    JSON.stringify(meuAcesso && meuAcesso.watchlist));
  checar('watchlist descarta turma inexistente', meuAcesso && !meuAcesso.watchlist.includes('turma-que-nao-existe'));
  const outro = depois.acessos.find((a) => a.alunoNome === 'Zoroastro');
  checar('watchlist não mexe no acesso de outro aluno', outro && !outro.watchlist);
  checar('fatia entrega a watchlist de volta', fatiaAluno(depois, config, acesso).watchlist.includes(t2.id));
}

checar('ação fora da lista é recusada', !acaoDoAluno({ type: 'DELETE_TURMA', id: t1.id }, acesso, s, config).ok);
checar('ação do professor é recusada', !acaoDoAluno({ type: 'CANCEL_AULA', turmaId: t1.id }, acesso, s, config).ok);

console.log(falhas ? `\n❌ ${falhas} falha(s) na fatia` : '\n✅ fatia do aluno ok');
process.exit(falhas ? 1 : 0);
