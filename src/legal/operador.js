// Dados de quem opera o AVIZ, usados nos Termos e na Política.
//
// Um lugar só, para a revisão jurídica preencher uma vez. Enquanto houver
// colchetes aqui, os textos são RASCUNHO — `textosProntos()` diz isso e as
// páginas mostram a faixa de aviso.

export const OPERADOR = {
  nome: 'AVIZ',
  razaoSocial: '[RAZÃO SOCIAL]',
  cnpj: '[CNPJ]',
  endereco: '[ENDEREÇO COMPLETO]',
  emailContato: '[E-MAIL DE CONTATO]',
  encarregado: '[NOME DO ENCARREGADO DE DADOS]',
  emailEncarregado: '[E-MAIL DO ENCARREGADO]',
  foro: '[CIDADE/UF DO FORO]',
  gateway: '[GATEWAY DE PAGAMENTO]',
};

// Data da versão vigente. Muda a cada revisão do texto; o aceite do
// onboarding guarda qual versão a escola aceitou.
export const VERSAO_TEXTOS = '2026-09-29-rascunho';

// Vira `true` quando um advogado revisar os textos. Até lá, as páginas mostram
// a faixa de rascunho.
export const REVISADO_JURIDICAMENTE = false;

// Os textos só estão prontos para valer quando revisados E sem nenhum campo
// em aberto.
export function textosProntos(op = OPERADOR, revisado = REVISADO_JURIDICAMENTE) {
  return revisado && !Object.values(op).some((v) => /\[.*\]/.test(String(v)));
}
