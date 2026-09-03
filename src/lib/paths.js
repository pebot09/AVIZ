// Caminhos do Realtime Database do AVIZ — um lugar só para a forma dos dados,
// para nenhuma tela montar string de caminho na mão.
//
//   /tenantsPublic/{tid}         vitrine pública (nome, logo, cor) — leitura livre
//   /tenants/{tid}/config        regras do onboarding (seção 5 da PLANTA)
//   /tenants/{tid}/state         turmas, faltas, reposicoes, vagas, ausencias, acessos, log, estatisticas
//   /tenants/{tid}/members/{uid} equipe: { role: 'owner' | 'professor', nome }
//   /tenants/{tid}/snapshots     backup automático por escola
//   /billing/{tid}               plano/status/vencimento — só super-admin

export const paths = {
  tenantPublic: (tid) => `tenantsPublic/${tid}`,
  config: (tid) => `tenants/${tid}/config`,
  state: (tid) => `tenants/${tid}/state`,
  members: (tid) => `tenants/${tid}/members`,
  member: (tid, uid) => `tenants/${tid}/members/${uid}`,
  snapshots: (tid) => `tenants/${tid}/snapshots`,
  billing: (tid) => `billing/${tid}`,
};
