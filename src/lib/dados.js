// Exportar e excluir os dados de uma escola, no Firebase.
//
// Ação só do dono (ver regras). A decisão do que exportar e da ordem de
// remoção mora em domain/dadosEscola.js; aqui só lemos e apagamos.

import { ref, get, remove } from 'firebase/database';
import { db } from './firebase.js';
import { paths } from './paths.js';
import { esquecerTenant } from './tenant.js';
import { montarExportacao, planoExclusao } from '../domain/dadosEscola.js';

async function ler(caminho) {
  const snap = await get(ref(db, caminho));
  return snap.exists() ? snap.val() : null;
}

export async function exportarDadosEscola(tid, agora = Date.now()) {
  const [pub, config, state, members, snapshots] = await Promise.all([
    ler(paths.tenantPublic(tid)),
    ler(paths.config(tid)),
    ler(paths.state(tid)),
    ler(paths.members(tid)),
    ler(paths.snapshots(tid)),
  ]);
  return montarExportacao({ tenant: tid, pub, config, state, members, snapshots }, agora);
}

// Entrega o arquivo ao navegador como download.
export function baixarJson(obj, nomeArquivo) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Apaga a escola inteira, na ordem do plano. Se parar no meio (rede, regras),
// lança dizendo onde parou; rodar de novo continua de onde ficou, porque
// apagar o que já não existe não é erro.
export async function excluirEscola(tid, uidDono) {
  const members = (await ler(paths.members(tid))) || {};
  const plano = planoExclusao(tid, Object.keys(members), uidDono);
  for (const caminho of plano) {
    try {
      await remove(ref(db, caminho));
    } catch (e) {
      throw new Error(`A exclusão parou em "${caminho}": ${e.message || e}. Tente de novo para concluir.`);
    }
  }
  esquecerTenant(tid);
  return plano;
}
