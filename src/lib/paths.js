// Caminhos do Realtime Database do AVIZ — um lugar só para a forma dos dados,
// para nenhuma tela montar string de caminho na mão.
//
//   /tenantsPublic/{tid}         vitrine pública (nome, logo, cor) — leitura livre
//   /tenants/{tid}/config        regras do onboarding (seção 5 da PLANTA)
//   /tenants/{tid}/state         turmas, faltas, reposicoes, vagas, ausencias, acessos, log, estatisticas
//   /tenants/{tid}/members/{uid} equipe: { role: 'owner' | 'professor', nome }
//   /tenants/{tid}/snapshots     "fotos" da lista salvas à mão pelo professor
//   /tenants/{tid}/backups       backup automático do estado (anel das últimas N)
//   /billing/{tid}               plano/status/vencimento — só super-admin
//   /pinsProfessor/{tid}/{uid}   hash do PIN do professor — só o Worker (fora das regras)
//   /pinTentativas/{tid}/{ip}    limite de tentativas de PIN — só o Worker

export const paths = {
  tenantPublic: (tid) => `tenantsPublic/${tid}`,
  config: (tid) => `tenants/${tid}/config`,
  state: (tid) => `tenants/${tid}/state`,
  members: (tid) => `tenants/${tid}/members`,
  member: (tid, uid) => `tenants/${tid}/members/${uid}`,
  snapshots: (tid) => `tenants/${tid}/snapshots`,
  backups: (tid) => `tenants/${tid}/backups`,
  billing: (tid) => `billing/${tid}`,
  // Fora de /tenants, gravados só pelo Worker do PIN. O dono só pode apagá-los
  // (ao excluir a escola) — ver database.rules.json.
  pinsProfessor: (tid) => `pinsProfessor/${tid}`,
  pinTentativas: (tid) => `pinTentativas/${tid}`,
};
