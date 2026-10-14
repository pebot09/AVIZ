// Endereço (slug) de uma escola nova.
//
// A criação em si acontece no servidor (worker/escola.js, via
// src/lib/escolaApi.js), antes do login do dono.

import { ref, get } from 'firebase/database';
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
