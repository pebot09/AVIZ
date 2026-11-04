// Escola fictícia do vídeo (scripts/escolaDemo.js): confere que os dados
// montados mostram o que o roteiro precisa, em qualquer dia em que rodar.

import { montarEscolaDemo, PROTAGONISTA } from '../scripts/escolaDemo.js';
import { normalizeState } from '../src/domain/reducer.js';
import { fatiaAluno, vagasParaAluno } from '../src/domain/fatiaAluno.js';
import { computeResumoDia } from '../src/domain/resumo.js';
import { arr, todayStr, dateToStr, getFaltaExpiry, TURMA_EXTRA_ID } from '../src/domain/helpers.js';

let falhas = 0;
const checar = (nome, cond, extra) => {
  if (cond) console.log(`  ok  ${nome}`);
  else { console.log(`  ERRO ${nome}${extra ? ' — ' + extra : ''}`); falhas++; }
};

const { state, config, publico, codigoMarina } = montarEscolaDemo(new Date());
const s = normalizeState(state);
const turmas = s.turmas.filter((t) => t.id !== TURMA_EXTRA_ID);
const td = todayStr();
const em7 = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return dateToStr(d); })();

checar('nome da escola', publico.nome === 'Ateliê Barro Bom');
checar('4 turmas', turmas.length === 4);
checar('25 alunos', turmas.reduce((n, t) => n + t.alunos.length, 0) === 25);
checar('lotadas, 2 vagas e 1 vaga', JSON.stringify(turmas.map((t) => 7 - t.alunos.length)) === '[0,2,1,0]', JSON.stringify(turmas.map((t) => t.alunos.length)));
checar('Marina está na turma de terça', turmas[0].alunos.includes(PROTAGONISTA));
checar('link da Marina gerado', /^\d{6}$/.test(String(codigoMarina)));

const pendentes = s.faltas.filter((f) => f.status === 'pendente');
const vencendo = pendentes.filter((f) => { const e = getFaltaExpiry(f, config); return e >= td && e <= em7; });
checar('2 faltas perto de vencer (amarelo no Painel)', vencendo.length >= 2, vencendo.length + ' de ' + pendentes.length);
checar('regras do roteiro: 30 dias e 2 créditos de férias', config.regras.validadeFaltaDias === 30 && config.regras.feriasCreditos === 2);

const acesso = s.acessos.find((a) => a.alunoNome === PROTAGONISTA);
const fatia = fatiaAluno(s, config, acesso);
checar('Marina começa sem falta (o clipe 1 cria a primeira)', fatia.faltas.length === 0);
checar('há vagas em outras turmas para a Marina repor', vagasParaAluno(fatia).some((v) => v.turmaId !== turmas[0].id));
checar('uma reposição já marcada para o Resumo', s.reposicoes.length >= 1);
checar('um aluno de férias neste mês', s.ausencias.length === 1);
const algumDia = [0, 1, 2, 3, 4, 5, 6].map((n) => { const d = new Date(); d.setDate(d.getDate() + n); return dateToStr(d); })
  .some((dt) => computeResumoDia(s, dt, config).length > 0);
checar('Resumo do dia tem turmas nesta semana', algumDia);

console.log(falhas ? `\n❌ ${falhas} falha(s) na escola de demonstração` : '\n✅ escola de demonstração ok');
process.exit(falhas ? 1 : 0);
