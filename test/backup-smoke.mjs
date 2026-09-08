// Backup automático (domain/backup.js) — decisão pura, sem Firebase.

import { contarEstado, estadoTemConteudo, deveFazerBackup, chavesParaPodar, montarBackup, MAX_BACKUPS } from '../src/domain/backup.js';
import { reducer, normalizeState } from '../src/domain/reducer.js';
import { TURMA_EXTRA_ID } from '../src/domain/helpers.js';

const config = { regras: {}, calendario: { recessos: [] }, vocab: {} };
let falhas = 0;
const checar = (nome, cond, extra) => {
  if (cond) console.log(`  ok  ${nome}`);
  else { console.log(`  ERRO ${nome}${extra ? ' — ' + extra : ''}`); falhas++; }
};

// Estado com conteúdo real
let s = normalizeState({});
const d = (a) => { s = reducer(s, a, config, 'Prof'); };
d({ type: 'ADD_TURMA', encontros: [{ diaSemana: 'terça', hora: 9, minuto: 0 }], capacidade: 7 });
const t1 = s.turmas.find((t) => t.id !== TURMA_EXTRA_ID);
d({ type: 'ADD_ALUNO', turmaId: t1.id, nome: 'Bia' });

const c = contarEstado(s);
checar('conta turmas sem contar a extra', c.turmas === 1, JSON.stringify(c));
checar('conta alunos dentro das turmas', c.alunos === 1);

checar('escola vazia não vale backup', !estadoTemConteudo(normalizeState({})));
checar('escola com aluno vale backup', estadoTemConteudo(s));

// intervalo
const agora = 1_000_000_000_000;
checar('sem backups, faz', deveFazerBackup({}, agora));
checar('backup recente, não faz', !deveFazerBackup({ a: { ts: agora - 60_000 } }, agora));
checar('backup velho (>6h), faz', deveFazerBackup({ a: { ts: agora - 7 * 3600 * 1000 } }, agora));

// poda: mantém só os MAX_BACKUPS mais novos
const muitos = {};
for (let i = 0; i < MAX_BACKUPS + 3; i++) muitos[`b${i}`] = { ts: 1000 + i };
const podar = chavesParaPodar(muitos);
checar('poda o excesso', podar.length === 3, `podou ${podar.length}`);
checar('poda os mais antigos', podar.includes('b0') && podar.includes('b1') && podar.includes('b2'));
checar('não poda quando dentro do limite', chavesParaPodar({ a: { ts: 1 }, b: { ts: 2 } }).length === 0);

// montar backup carrega os dados e o resumo
const b = montarBackup(s, agora);
checar('backup guarda ts, resumo e dados', b.ts === agora && b.resumo.turmas === 1 && b.dados === s);

console.log(falhas ? `\n❌ ${falhas} falha(s) no backup` : '\n✅ backup automático ok');
process.exit(falhas ? 1 : 0);
