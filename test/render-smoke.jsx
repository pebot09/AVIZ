import React from 'react';
import { renderToString } from 'react-dom/server';
import { reducer, normalizeState } from '../src/domain/reducer.js';
import { TURMA_EXTRA_ID, todayStr } from '../src/domain/helpers.js';
import { getNextOccurrences, isDataBloqueada } from '../src/domain/calendario.js';
import { makeVocab } from '../src/domain/vocab.js';
import { construirDados } from '../src/domain/painel.js';
import { dateToStr } from '../src/domain/helpers.js';

import PainelTab from '../src/components/PainelTab.jsx';
import PainelVisual, { DetalheModal } from '../src/components/PainelVisual.jsx';
import PainelRegistro from '../src/components/PainelRegistro.jsx';
import ResumoDia from '../src/components/ResumoDia.jsx';
import SnapshotsModal, { snapshotFromState } from '../src/components/Snapshots.jsx';
import TurmasTab from '../src/components/TurmasTab.jsx';
import FaltasReposicoesTab from '../src/components/FaltasReposicoesTab.jsx';
import NotasTurmaModal from '../src/components/NotasTurmaModal.jsx';
import GerarLinkModal from '../src/components/GerarLinkModal.jsx';
import AlunoApp from '../src/components/aluno/AlunoApp.jsx';
import RegrasModal from '../src/components/aluno/RegrasModal.jsx';
import { fatiaAluno, vagasParaAluno } from '../src/domain/fatiaAluno.js';

const config = {
  regras: { capacidadeNominal: 7, capacidadeFisica: 8, validadeFaltaDias: 30, validadeFeriasDias: 30, antecedenciaHoras: 2, semAntecedencia: true, ferias: true, feriasCredito: true, feriasCreditos: 1, feriasLimiteAno: 0 },
  calendario: { recessos: [], feriadosMunicipais: [], feriadosIgnorados: [] },
  vocab: {},
};
const vocab = makeVocab(config);
let s = normalizeState({});
const d = (a) => { s = reducer(s, a, config, 'Ana'); };

d({ type: 'ADD_TURMA', encontros: [{ diaSemana: 'terça', hora: 9, minuto: 0 }, { diaSemana: 'quinta', hora: 9, minuto: 0 }], capacidade: 7 });
const turma = s.turmas.find(t => t.id !== TURMA_EXTRA_ID);
['Bia','Caio','Dora'].forEach(n => d({ type: 'ADD_ALUNO', turmaId: turma.id, nome: n }));
d({ type: 'ADD_ALUNO', turmaId: TURMA_EXTRA_ID, nome: 'Ex-aluno' });
const prox = getNextOccurrences(turma, 4);
d({ type: 'ADD_FALTA', alunoNome: 'Bia', turmaId: turma.id, datasComTipo: [{ data: prox[0], semAntecedencia: false }] });
d({ type: 'ADD_FALTA', alunoNome: 'Caio', turmaId: turma.id, datasComTipo: [{ data: prox[1], semAntecedencia: true }] });
d({ type: 'ADD_NOTA', turmaId: turma.id, texto: 'trazer tapete' });
d({ type: 'GERAR_ACESSO', alunoNome: 'Bia', turmaId: turma.id });
d({ type: 'ADD_AUSENCIA', alunoNome: 'Dora', turmaId: turma.id, mesAno: todayStr().slice(0,7) });

// segunda turma, para a reposição ter destino (ninguém repõe na própria turma)
d({ type: 'ADD_TURMA', encontros: [{ diaSemana: 'segunda', hora: 19, minuto: 30 }], capacidade: 7 });
const turma2 = s.turmas.filter(t => t.id !== TURMA_EXTRA_ID)[1];
d({ type: 'ADD_ALUNO', turmaId: turma2.id, nome: 'Eva' });
const dataEva = getNextOccurrences(turma2, 6).find(x => !isDataBloqueada(x, config));
d({ type: 'ADD_FALTA', alunoNome: 'Eva', turmaId: turma2.id, datasComTipo: [{ data: dataEva, semAntecedencia: false }] });
// Bia repõe na turma 2, consumindo a vaga que a falta da Eva abriu
const vagaEva = s.vagas.find(v => v.turmaId === turma2.id);
const faltaBia = s.faltas.find(f => f.alunoNome === 'Bia');
d({ type: 'ADD_REPOSICAO', alunoNome: 'Bia', turmaOrigemId: turma.id, faltaId: faltaBia.id,
    turmaReposicaoId: turma2.id, dataReposicao: vagaEva.data, vagaSelId: vagaEva.id, tipo: 'reposicao' });
d({ type: 'CANCEL_AULA', turmaId: turma.id, data: prox[2] });
d({ type: 'FREEZE_RESUMOS' });
d({ type: 'SAVE_SNAPSHOT', label: 'foto teste', dados: snapshotFromState(s, config) });


// Shim de teste: força os acordeões abertos, para exercitar o JSX que só
// aparece expandido — exatamente onde mora o bug de tela branca.
const _useState = React.useState;
globalThis.__DATA_FORCADA__ = null;
React.useState = function (init) {
  if (init && typeof init === 'object' && !Array.isArray(init) && 'faltas' in init && 'vagas' in init) {
    return _useState(Object.fromEntries(Object.keys(init).map((k) => [k, true])));
  }
  // acordeões da tela do aluno
  if (init && typeof init === 'object' && !Array.isArray(init) && 'falta' in init && 'reposicao' in init) {
    return _useState(Object.fromEntries(Object.keys(init).map((k) => [k, true])));
  }
  // força a data do ResumoDia, para cair num dia com aulas
  if (typeof init === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(init) && globalThis.__DATA_FORCADA__) {
    return _useState(globalThis.__DATA_FORCADA__);
  }
  return _useState(init);
};

const noop = () => {};
const casos = [
  ['PainelTab', <PainelTab state={s} dispatch={noop} vocab={vocab} config={config} podeEditarLog />],
  ['PainelVisual', <PainelVisual state={s} dispatch={noop} vocab={vocab} config={config} />],
  ['PainelRegistro', <PainelRegistro state={s} dispatch={noop} podeEditar />],
  ['ResumoDia (hoje)', <ResumoDia state={s} vocab={vocab} config={config} />],
  ['SnapshotsModal', <SnapshotsModal state={s} dispatch={noop} config={config} vocab={vocab} onClose={noop} />],
  ['TurmasTab', <TurmasTab state={s} dispatch={noop} vocab={vocab} config={config} capacidadePadrao={7} tenantId="t1" autor="Ana" />],
  ['FaltasReposicoesTab', <FaltasReposicoesTab state={s} dispatch={noop} vocab={vocab} config={config} />],
  ['NotasTurmaModal', <NotasTurmaModal turma={turma} state={s} dispatch={noop} tenantId="t1" autor="Ana" onClose={noop} />],
  ['GerarLinkModal', <GerarLinkModal state={s} dispatch={noop} vocab={vocab} onClose={noop} />],
];


// --- modal de detalhes: os 4 tipos ---
const _td = todayStr();
const _in7 = (() => { const x = new Date(); x.setDate(x.getDate()+7); return dateToStr(x); })();
const _d2 = (() => { const x = new Date(); x.setDate(x.getDate()-2); return dateToStr(x); })();
const dd = construirDados(s, config, _td, _in7, _d2);
const detCasos = [];
const gFalta = dd.combined.find(c => c.tipo === 'falta');
if (gFalta) detCasos.push(['det:falta', { tipo: 'falta', obj: gFalta.obj }]);
const gFerias = dd.combined.find(c => c.tipo === 'ausencia');
if (gFerias) detCasos.push(['det:ausencia', { tipo: 'ausencia', obj: gFerias.obj }]);
if (dd.marcadasGrupos[0]) detCasos.push(['det:marcada', { tipo: 'marcada', obj: dd.marcadasGrupos[0] }]);
if (dd.reposAtivas[0]) detCasos.push(['det:reposicao', { tipo: 'reposicao', obj: dd.reposAtivas[0] }]);
if (dd.vagasGrupos[0]) detCasos.push(['det:vaga', { tipo: 'vaga', obj: dd.vagasGrupos[0] }]);
console.log('  (grupos: falta=' + !!gFalta + ' ferias=' + !!gFerias + ' marcada=' + dd.marcadasGrupos.length + ' repo=' + dd.reposAtivas.length + ' vaga=' + dd.vagasGrupos.length + ')');
for (const [nome, det] of detCasos) {
  casos.push([nome, <DetalheModal det={det} setDet={noop} state={s} dispatch={noop} vocab={vocab} config={config} td={_td} in7={_in7} />]);
}


// ResumoDia num dia futuro com aulas, e num dia passado congelado
const diaComAula = getNextOccurrences(turma, 6).find(x => !isDataBloqueada(x, config));
const diaCongelado = Object.keys(s.resumosDiarios).sort().pop();
// --- tela do aluno ---
// A fatia é montada do estado real, então a tela recebe exatamente o que
// receberia em produção.
// Uma vaga em OUTRA turma, que sobra para a Bia escolher (a da própria turma
// dela é filtrada de propósito — ninguém repõe na aula que já frequenta).
d({ type: 'ADD_ALUNO', turmaId: turma2.id, nome: 'Fabio' });
const dataFabio = getNextOccurrences(turma2, 8).filter(x => !isDataBloqueada(x, config))[1];
d({ type: 'ADD_FALTA', alunoNome: 'Fabio', turmaId: turma2.id, datasComTipo: [{ data: dataFabio, semAntecedencia: false }] });
d({ type: 'GERAR_ACESSO', alunoNome: 'Bia', turmaId: turma.id });
const acessoBia = s.acessos.find(a => a.alunoNome === 'Bia');
const fatiaBia = fatiaAluno(s, config, acessoBia);
const okAcao = async () => true;
const configMinimo = { regras: { antecedenciaHoras: 0, ferias: false, vagaExtra: false, validadeFaltaDias: 0 }, calendario: { recessos: [] }, vocab: {} };
console.log('  (aluno: vagas oferecidas=' + vagasParaAluno(fatiaBia).length + ' faltas=' + fatiaBia.faltas.length + ')');
if (!vagasParaAluno(fatiaBia).length) { console.log('  ERRO fixture sem vaga para o aluno escolher'); falhas++; }
casos.push(['AlunoApp', <AlunoApp fatia={fatiaBia} config={config} vocab={vocab} nomeEscola="Escola Teste" executar={okAcao} ocupado={false} erro={null} />]);
casos.push(['AlunoApp (ocupado+erro)', <AlunoApp fatia={fatiaBia} config={config} vocab={vocab} nomeEscola="Escola Teste" executar={okAcao} ocupado erro="Deu ruim" />]);
casos.push(['AlunoApp (escola sem regras)', <AlunoApp fatia={fatiaBia} config={configMinimo} vocab={vocab} nomeEscola="Escola Teste" executar={okAcao} ocupado={false} erro={null} />]);
casos.push(['RegrasModal', <RegrasModal config={config} vocab={vocab} onClose={noop} />]);
casos.push(['RegrasModal (sem regras)', <RegrasModal config={configMinimo} vocab={vocab} onClose={noop} />]);

casos.push(['ResumoDia: ' + diaComAula, <ResumoDia state={s} vocab={vocab} config={config} />]);
if (diaCongelado) casos.push(['ResumoDia: ' + diaCongelado, <ResumoDia state={s} vocab={vocab} config={config} />]);
let falhas = 0;
for (const [nome, el] of casos) {
  try {
    globalThis.__DATA_FORCADA__ = nome.startsWith('ResumoDia:') ? nome.split(':')[1].trim() : null;
    const html = renderToString(el);
    console.log(`  ok  ${nome.padEnd(20)} ${html.length} chars`);
  } catch (e) {
    falhas++;
    console.log(`  ERRO ${nome}: ${e.message}`);
  }
}
console.log(falhas ? `\n❌ ${falhas} componente(s) quebraram` : '\n✅ todos renderizaram');
process.exit(falhas ? 1 : 0);
