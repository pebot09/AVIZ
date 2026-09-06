// Cliente da fatia do aluno.
//
// O aluno não fala com o banco: as regras o barram de propósito (ele não tem
// conta, e ler o estado da escola exporia todos os outros alunos). Tudo passa
// pelo Worker da Cloudflare em /api/aluno, que confere o código e devolve só o
// que é dele. Mesma origem do app — sem CORS, sem URL externa.

const BASE = '/api/aluno';

export class ErroAluno extends Error {
  constructor(mensagem, tipo) { super(mensagem); this.tipo = tipo; }
}

async function chamar(url, init) {
  let resp;
  try {
    resp = await fetch(url, init);
  } catch {
    throw new ErroAluno('Não consegui falar com o servidor. Verifique sua conexão e tente de novo.', 'rede');
  }
  let corpo = null;
  try { corpo = await resp.json(); } catch { /* resposta sem json */ }

  if (!resp.ok) {
    const msg = (corpo && corpo.erro)
      || (resp.status === 503 ? 'O acesso do aluno ainda não foi ativado nesta escola.'
        : 'Não foi possível completar. Tente de novo.');
    throw new ErroAluno(msg, resp.status === 409 ? 'conflito' : 'servidor');
  }
  return corpo;
}

export function buscarFatia(tenant, codigo) {
  return chamar(`${BASE}?e=${encodeURIComponent(tenant)}&c=${encodeURIComponent(codigo)}`, { method: 'GET' });
}

export function enviarAcao(tenant, codigo, acao) {
  return chamar(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ e: tenant, c: codigo, acao }),
  });
}
