// Cliente da fatia do aluno.
//
// O aluno não fala com o banco: as regras o barram de propósito (ele não tem
// conta, e ler o estado da escola exporia todos os outros alunos). Tudo passa
// pela função `aluno`, que confere o código e devolve só o que é dele.

const REGIAO = 'us-central1';
const PROJETO = 'aviz-cb3c8';

// Em produção o endereço vem do build; no padrão, a função do projeto.
const BASE = (import.meta.env && import.meta.env.VITE_ALUNO_API)
  || `https://${REGIAO}-${PROJETO}.cloudfunctions.net/aluno`;

async function chamar(opcoes) {
  let resp;
  try {
    resp = await fetch(opcoes.url, opcoes.init);
  } catch {
    // Rede fora, ou a função ainda não publicada.
    throw new ErroAluno('Não consegui falar com o servidor. Verifique sua conexão e tente de novo.', 'rede');
  }
  let corpo = null;
  try { corpo = await resp.json(); } catch { /* resposta sem json */ }

  if (!resp.ok) {
    const msg = (corpo && corpo.erro) || (resp.status === 404
      ? 'O acesso do aluno ainda não foi ativado nesta escola.'
      : 'Não foi possível completar. Tente de novo.');
    throw new ErroAluno(msg, resp.status === 409 ? 'conflito' : 'servidor');
  }
  return corpo;
}

export class ErroAluno extends Error {
  constructor(mensagem, tipo) { super(mensagem); this.tipo = tipo; }
}

export function buscarFatia(tenant, codigo) {
  const url = `${BASE}?e=${encodeURIComponent(tenant)}&c=${encodeURIComponent(codigo)}`;
  return chamar({ url, init: { method: 'GET' } });
}

export function enviarAcao(tenant, codigo, acao) {
  return chamar({
    url: BASE,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ e: tenant, c: codigo, acao }),
    },
  });
}
