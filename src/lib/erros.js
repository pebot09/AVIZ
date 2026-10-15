// Mensagens de erro em português.
//
// O Firebase devolve erros em inglês ("Firebase: Error (auth/invalid-email).",
// "PERMISSION_DENIED: Permission denied"). Nada disso pode chegar à tela da
// escola: traduzimos os códigos que acontecem de verdade e trocamos o resto
// por uma mensagem genérica. Mensagens que já são nossas passam intactas.

const POR_CODIGO = {
  'auth/invalid-email': 'Esse e-mail não parece válido. Confira e tente de novo.',
  'auth/missing-email': 'Informe o e-mail.',
  'auth/too-many-requests': 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
  'auth/quota-exceeded': 'Muitos e-mails enviados hoje. Tente de novo mais tarde.',
  'auth/network-request-failed': 'Sem conexão com a internet. Verifique e tente de novo.',
  'auth/invalid-action-code': 'Este link de acesso já foi usado ou não vale mais. Peça um link novo.',
  'auth/expired-action-code': 'Este link de acesso expirou. Peça um link novo.',
  'auth/invalid-credential': 'Não deu para entrar. Peça um link novo.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/unauthorized-continue-uri': 'Este endereço ainda não está liberado para login. Fale com o suporte do AVIZ.',
  'auth/unauthorized-domain': 'Este endereço ainda não está liberado para login. Fale com o suporte do AVIZ.',
  'auth/invalid-custom-token': 'Não deu para entrar com o PIN. Tente de novo.',
};

export function mensagemDeErro(e) {
  const code = e && e.code;
  if (code && POR_CODIGO[code]) return POR_CODIGO[code];
  const msg = String((e && e.message) || e || '');
  if (/PERMISSION_DENIED|permission[_ ]denied/i.test(msg)) return 'Você não tem permissão para fazer isso. Entre de novo e tente outra vez.';
  if (code || /^Firebase:|\b(auth|database)\//i.test(msg)) return 'Algo deu errado. Tente de novo em instantes.';
  return msg || 'Algo deu errado. Tente de novo em instantes.';
}
