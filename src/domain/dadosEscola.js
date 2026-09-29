// Exportação e exclusão dos dados de uma escola (LGPD — PLANTA, seção 7).
//
// Só decisões puras aqui: o que entra no arquivo exportado e em que ordem os
// caminhos são apagados. A leitura e a remoção no Firebase ficam em
// lib/dados.js, para dar para testar isto sem banco.

import { contarEstado } from './backup.js';
import { paths } from '../lib/paths.js';

export const FORMATO_EXPORTACAO = 'aviz-exportacao';
export const VERSAO_EXPORTACAO = 1;

// Tudo o que a escola tem no AVIZ, num arquivo só e legível. Ficam de fora:
// os backups automáticos (cópias antigas do mesmo `dados`), os hashes de PIN
// (credencial, não dado da escola) e as tentativas de PIN (registro de
// segurança do Worker).
export function montarExportacao({ tenant, pub, config, state, members, snapshots }, agora = Date.now()) {
  const dados = { ...(state || {}) };
  delete dados._updatedAt; // controle interno de gravação, não é dado da escola
  return {
    formato: FORMATO_EXPORTACAO,
    versao: VERSAO_EXPORTACAO,
    escola: tenant,
    geradoEm: new Date(agora).toISOString(),
    resumo: contarEstado(dados),
    vitrine: pub || {},
    config: config || {},
    equipe: Object.fromEntries(
      Object.entries(members || {}).map(([uid, m]) => [uid, { nome: (m && m.nome) || '', role: (m && m.role) || '' }]),
    ),
    dados,
    snapshots: snapshots || {},
  };
}

export function nomeArquivoExportacao(tenant, agora = Date.now()) {
  return `aviz-${tenant}-${new Date(agora).toISOString().slice(0, 10)}.json`;
}

// Ordem de remoção, ditada pelas regras do banco (database.rules.json):
//   1. os outros membros primeiro — assim ninguém mais consegue gravar no
//      `state` enquanto ele é apagado (e recriar a escola pela metade);
//   2. estado, fotos e backups (qualquer membro pode; o dono ainda é membro);
//   3. hashes de PIN e tentativas de PIN (com IPs), que vivem fora de
//      /tenants; config e vitrine pública (exigem ser dono — o dono ainda é);
//   4. o próprio dono por último: depois disso ele não escreve mais nada.
// `/billing` não entra: só o operador mexe lá, com o Admin SDK.
export function planoExclusao(tid, uidsMembros, uidDono) {
  const outros = (uidsMembros || []).filter((u) => u !== uidDono).sort();
  return [
    ...outros.map((u) => paths.member(tid, u)),
    paths.state(tid),
    paths.snapshots(tid),
    paths.backups(tid),
    paths.pinsProfessor(tid),
    paths.pinTentativas(tid),
    paths.config(tid),
    paths.tenantPublic(tid),
    paths.member(tid, uidDono),
  ];
}

// A exclusão só roda se o dono digitar o endereço da escola, igualzinho.
export function confirmacaoExclusaoOk(digitado, tid) {
  return !!tid && String(digitado || '').trim().toLowerCase() === String(tid).toLowerCase();
}
