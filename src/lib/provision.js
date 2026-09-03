// Provisionamento de uma escola nova (o que o onboarding cria).
//
// Ordem importa por causa das regras: primeiro viramos dono (bootstrap do
// membro numa escola vazia), depois escrevemos a vitrine pública e o config —
// que já exigem ser dono.
//
// Em produção isto vira uma Cloud Function com Admin SDK (não depende de
// afrouxar regras). Por ora, roda no cliente com a cláusula de bootstrap.

import { ref, get, set } from 'firebase/database';
import { db } from './firebase.js';
import { paths } from './paths.js';

export async function slugDisponivel(slug) {
  const snap = await get(ref(db, paths.tenantPublic(slug)));
  return !snap.exists();
}

// Acha um endereço livre a partir de uma base, anexando -2, -3… se preciso.
export async function slugDisponivelAuto(base) {
  let slug = base;
  let n = 1;
  while (!(await slugDisponivel(slug))) {
    n += 1;
    slug = `${base}-${n}`;
    if (n > 999) throw new Error('Não foi possível gerar um endereço.');
  }
  return slug;
}

export function slugify(txt) {
  return (txt || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // tira acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// Cria a escola. `uid` é o dono. Retorna o slug.
export async function provisionTenant({ slug, nomeEscola, artigo, cor, donoNome, donoGenero, config, uid }) {
  await set(ref(db, paths.member(slug, uid)), { role: 'owner', nome: donoNome || 'Dono', genero: donoGenero || 'o' });
  await set(ref(db, paths.tenantPublic(slug)), { nome: nomeEscola, artigo: artigo || 'o', cor: cor || '#2563eb' });
  await set(ref(db, paths.config(slug)), config);
  return slug;
}
