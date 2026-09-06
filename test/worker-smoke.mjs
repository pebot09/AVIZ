// Worker do aluno (Cloudflare).
//
// A lógica de fatia/ações já é coberta por fatia-smoke. Aqui o alvo é o
// encanamento HTTP do Worker: roteamento, validação de link, o carimbo de
// identidade ponta a ponta e o conflito por ETag. O Firebase é substituído por
// um banco de mentira, então nada sai para a rede.

import { criarHandlerAluno } from '../worker/index.js';
import { reducer, normalizeState } from '../src/domain/reducer.js';
import { todayStr, TURMA_EXTRA_ID } from '../src/domain/helpers.js';
import { getNextOccurrences, isDataBloqueada } from '../src/domain/calendario.js';

const config = {
  regras: { capacidadeNominal: 7, capacidadeFisica: 8, validadeFaltaDias: 30, antecedenciaHoras: 22, semAntecedencia: true, semAntecedenciaJanela: 2, ferias: true, feriasCredito: true, feriasCreditos: 1, feriasValidadeDias: 30, feriasLimiteAno: 1 },
  calendario: { recessos: [], feriadosMunicipais: [], feriadosIgnorados: [] },
  vocab: {},
};

let falhas = 0;
const checar = (nome, cond, extra) => {
  if (cond) console.log(`  ok  ${nome}`);
  else { console.log(`  ERRO ${nome}${extra ? ' — ' + extra : ''}`); falhas++; }
};

// Monta uma escola.
let s = normalizeState({});
const d = (a) => { s = reducer(s, a, config, 'Professora'); };
d({ type: 'ADD_TURMA', encontros: [{ diaSemana: 'terça', hora: 9, minuto: 0 }], capacidade: 7 });
d({ type: 'ADD_TURMA', encontros: [{ diaSemana: 'quinta', hora: 19, minuto: 30 }], capacidade: 7 });
const [t1, t2] = s.turmas.filter((t) => t.id !== TURMA_EXTRA_ID);
d({ type: 'ADD_ALUNO', turmaId: t1.id, nome: 'Ana' });
d({ type: 'ADD_ALUNO', turmaId: t2.id, nome: 'Bento' });
const proxT2 = getNextOccurrences(t2, 8).filter((x) => !isDataBloqueada(x, config));
d({ type: 'ADD_FALTA', alunoNome: 'Bento', turmaId: t2.id, datasComTipo: [{ data: proxT2[0], semAntecedencia: false }] }); // abre vaga em t2
d({ type: 'GERAR_ACESSO', alunoNome: 'Ana', turmaId: t1.id });
const CODIGO = s.acessos.find((a) => a.alunoNome === 'Ana').codigo;

// Banco de mentira: guarda o estado e um ETag que muda a cada escrita.
function fakeDeps(estadoInicial) {
  let estado = { ...estadoInicial, _updatedAt: 1000 };
  let etag = 'etag-1';
  return {
    _get: () => estado,
    _forcarMudancaExterna: () => { estado = { ...estado, _updatedAt: estado._updatedAt + 1 }; etag = 'etag-externo'; },
    async lerTudo() { return { bruto: estado, etag, config, pub: { nome: 'Escola Teste' } }; },
    async gravar(tid, dados, etagRecebido) {
      if (etagRecebido !== etag) return { conflito: true };
      estado = dados; etag = 'etag-' + Math.random();
      return { conflito: false };
    },
  };
}

const req = (metodo, corpoOuQs) => (metodo === 'GET'
  ? { method: 'GET' }
  : { method: 'POST', text: async () => JSON.stringify(corpoOuQs) });
const urlCom = (qs) => new URL(`https://aviz.example.com/api/aluno${qs}`);

async function corpo(resp) { return JSON.parse(await resp.text()); }

// ---- GET devolve a fatia ----
{
  const h = criarHandlerAluno(fakeDeps(s));
  const resp = await h(req('GET'), urlCom(`?e=escola&c=${CODIGO}`));
  const b = await corpo(resp);
  checar('GET responde 200', resp.status === 200, String(resp.status));
  checar('GET traz a fatia da aluna certa', b.fatia && b.fatia.aluno.nome === 'Ana');
  checar('GET traz o nome da escola', b.escola.nome === 'Escola Teste');
  checar('GET não vaza o outro aluno', !JSON.stringify(b).includes('Bento'));
  checar('GET oferece a vaga de outra turma', b.fatia.vagas.some((v) => v.turmaId === t2.id));
}

// ---- Link inválido ----
{
  const h = criarHandlerAluno(fakeDeps(s));
  checar('link sem código = 400', (await h(req('GET'), urlCom('?e=escola'))).status === 400);
  checar('código inexistente = 403', (await h(req('GET'), urlCom('?e=escola&c=000000'))).status === 403);
  checar('slug inválido = 400', (await h(req('GET'), urlCom('?e=Escola!&c=' + CODIGO))).status === 400);
}

// ---- POST aplica ação e persiste ----
{
  const deps = fakeDeps(s);
  const h = criarHandlerAluno(deps);
  const acao = { type: 'ADD_AUSENCIA', tipo: 'ferias', mesAno: todayStr().slice(0, 7) };
  const resp = await h(req('POST', { e: 'escola', c: CODIGO, acao }), urlCom(''));
  checar('POST responde 200', resp.status === 200, String(resp.status));
  checar('POST gravou no banco', (deps._get().ausencias || []).some((a) => a.alunoNome === 'Ana'));
  const b = await corpo(resp);
  checar('POST devolve a fatia já atualizada', b.fatia.ausencias.length === 1);
}

// ---- POST carimba a identidade (não confia no corpo) ----
{
  const deps = fakeDeps(s);
  const h = criarHandlerAluno(deps);
  // pedido tenta faltar como "Bento" na turma t2 — deve virar Ana/t1
  const acao = { type: 'ADD_FALTA', alunoNome: 'Bento', turmaId: t2.id, datasComTipo: [] };
  await h(req('POST', { e: 'escola', c: CODIGO, acao }), urlCom(''));
  checar('ninguém age no lugar de outro pelo corpo', !(deps._get().faltas || []).some((f) => f.alunoNome === 'Bento' && f.criadoPor === 'Ana'));
}

// ---- POST recusa ação fora da lista ----
{
  const h = criarHandlerAluno(fakeDeps(s));
  const resp = await h(req('POST', { e: 'escola', c: CODIGO, acao: { type: 'DELETE_TURMA', id: t1.id } }), urlCom(''));
  checar('ação de professor é recusada (403)', resp.status === 403);
}

// ---- Conflito por ETag ----
{
  const deps = fakeDeps(s);
  const h = criarHandlerAluno(deps);
  // alguém mexe na escola depois que o handler já leu — simulamos gravando com
  // um ETag velho: a mudança externa troca o ETag do banco.
  const acao = { type: 'ADD_AUSENCIA', tipo: 'ferias', mesAno: todayStr().slice(0, 7) };
  // primeiro leremos e então forçamos a mudança externa antes do gravar:
  const depsComRace = {
    ...deps,
    lerTudo: deps.lerTudo,
    gravar: async (tid, dados, etag) => { deps._forcarMudancaExterna(); return deps.gravar(tid, dados, etag); },
  };
  const resp = await criarHandlerAluno(depsComRace)(req('POST', { e: 'escola', c: CODIGO, acao }), urlCom(''));
  checar('gravação sobre versão mais nova = 409', resp.status === 409, String(resp.status));
}

// ---- Método não suportado ----
{
  const h = criarHandlerAluno(fakeDeps(s));
  checar('DELETE = 405', (await h({ method: 'DELETE' }, urlCom(`?e=escola&c=${CODIGO}`))).status === 405);
}

console.log(falhas ? `\n❌ ${falhas} falha(s) no worker` : '\n✅ worker do aluno ok');
process.exit(falhas ? 1 : 0);
