// Cadastro de alunos em lote: a escola cola uma lista de nomes (de planilha,
// WhatsApp, bloco de notas) e o app separa quem entra e quem já estava.
//
// Um nome por linha. Numeração e marcadores do começo ("1.", "2)", "-", "•",
// "*") saem; espaços repetidos viram um. Nome repetido — na lista ou já na
// turma, sem diferença de maiúsculas e acentos — não entra duas vezes.

const MAX_NOME = 60;

function chave(nome) {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function limparNome(linha) {
  return String(linha || '')
    .replace(/^\s*(?:\d+\s*[.)\-–:]|[-–•*·])\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NOME);
}

// → { novos: [nomes que entram], jaNaTurma: [nomes ignorados] }
export function lerListaDeAlunos(texto, existentes = []) {
  const vistos = new Set(existentes.map(chave));
  const novos = [];
  const jaNaTurma = [];
  for (const linha of String(texto || '').split(/\r?\n/)) {
    const nome = limparNome(linha);
    if (!nome) continue;
    const k = chave(nome);
    if (vistos.has(k)) {
      if (existentes.some((e) => chave(e) === k) && !jaNaTurma.includes(nome)) jaNaTurma.push(nome);
      continue;
    }
    vistos.add(k);
    novos.push(nome);
  }
  return { novos, jaNaTurma };
}
