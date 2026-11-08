// As cenas do tutorial: cada uma abre o app, faz alguns toques e diz o que
// capturar (a tela inteira ou um pedaço) e onde ficam os marcadores numerados.
//
// marcas: [número, (page) => locator, âncora?]  (âncora: c, l, r, t, b)

const E = '/?e=atelie-barro-bom';
const ALUNO = `${E}&c=482913`;

// ---- atalhos ----
const modal = (p) => p.locator('.shadow-2xl').last();
const folha = (p) => p.locator('.rounded-t-2xl').last(); // janelas de baixo, no app do aluno
const botao = (p, nome, exato = true) => p.getByRole('button', { name: nome, exact: exato });
const texto = (p, t, exato = true) => p.getByText(t, { exact: exato });
const cartaoTurma = (p, nome) => p.locator('div.bg-white.rounded-xl.shadow-sm.border').filter({ hasText: nome }).first();
const abrirTurma = (p, nome) => cartaoTurma(p, nome).locator('div.cursor-pointer').first().click();
const grupo = (p, i) => p.locator('.max-w-2xl .space-y-3 > div').nth(i);
const abrirGrupo = (p, i) => grupo(p, i).locator('> button').click();
const cartaoAluno = (p, titulo) => p.locator('div.bg-white.rounded-xl.shadow-sm.border').filter({ has: p.getByText(titulo, { exact: true }) }).first();
const blocoPainel = (p, titulo) => p.locator('div.bg-gray-800').filter({ hasText: titulo }).first();
const listaPainel = (p) => p.locator('div.bg-white.rounded-xl.shadow-sm.border.overflow-hidden').first();
const reporLivre = (p) => p.locator('#card-reposicao button:not([disabled])').filter({ hasText: /^Repor$/ });
const pausa = (p, ms = 300) => p.waitForTimeout(ms);

// Escolhe a opção de um <select> pelo pedaço do texto.
async function escolher(select, contem) {
  const opcoes = await select.locator('option').allTextContents();
  const i = typeof contem === 'number' ? contem : opcoes.findIndex((o) => o.includes(contem));
  if (i < 0) throw new Error(`opção "${contem}" não existe (${opcoes.join(' / ')})`);
  await select.selectOption({ index: i });
}

const abaFaltas = (p) => botao(p, 'Faltas & Reposições').click();
const abaPainel = (p) => botao(p, 'Painel').click();
async function abrirConfig(p, secao) {
  await p.getByTitle('Configurações').click();
  if (secao) await modal(p).getByText(secao, { exact: true }).click();
  await pausa(p);
}

function mesQueVem() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function proximoDia(diaSemana) { // 0 = domingo
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== diaSemana) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const CENAS = [
  // ============ Entrar ============
  {
    id: 'convite', url: '/?convite=a1b2c3', quem: 'ninguem',
    passos: async (p) => {
      await p.getByPlaceholder('PIN', { exact: true }).fill('2580');
      await p.getByPlaceholder('Repita o PIN').fill('2580');
      await p.locator('input[type=checkbox]').check();
    },
    marcas: [
      [1, (p) => p.getByPlaceholder('PIN', { exact: true }), 'r'],
      [2, (p) => p.getByPlaceholder('Repita o PIN'), 'r'],
      [3, (p) => p.locator('input[type=checkbox]'), 'l'],
      [4, (p) => botao(p, 'Entrar no app'), 'r'],
    ],
  },
  {
    id: 'login', url: E, quem: 'ninguem',
    passos: async (p) => {
      await p.getByLabel('E-mail').fill('marta@barrobom.com.br');
      await p.getByLabel('PIN').fill('2580');
    },
    marcas: [
      [1, (p) => p.getByLabel('E-mail'), 'r'],
      [2, (p) => p.getByLabel('PIN'), 'r'],
      [3, (p) => botao(p, 'Entrar'), 'r'],
      [4, (p) => botao(p, 'Esqueci meu PIN'), 'r'],
    ],
  },
  {
    id: 'esqueci', url: E, quem: 'ninguem',
    passos: async (p) => {
      await botao(p, 'Esqueci meu PIN').click();
      await p.getByLabel('E-mail').fill('marta@barrobom.com.br');
    },
    marcas: [[1, (p) => p.getByLabel('E-mail'), 'r'], [2, (p) => botao(p, 'Enviar link'), 'r']],
  },
  {
    id: 'esqueci-enviado', url: E, quem: 'ninguem',
    passos: async (p) => {
      await botao(p, 'Esqueci meu PIN').click();
      await p.getByLabel('E-mail').fill('marta@barrobom.com.br');
      await botao(p, 'Enviar link').click();
      await pausa(p, 500);
    },
  },
  {
    id: 'novopin', url: `${E}&novopin=1`, quem: 'dona',
    passos: async (p) => {
      await p.getByPlaceholder('PIN', { exact: true }).fill('1470');
      await p.getByPlaceholder('Repita o PIN').fill('1470');
    },
    marcas: [[1, (p) => p.getByPlaceholder('PIN', { exact: true }), 'r'], [2, (p) => p.getByPlaceholder('Repita o PIN'), 'r'], [3, (p) => botao(p, 'Salvar e entrar'), 'r']],
  },
  {
    id: 'primeira', url: '/?e=atelie-novo', quem: 'dona', guiaVisto: false,
    marcas: [
      [1, (p) => botao(p, 'Copiar endereço'), 'r'],
      [2, (p) => botao(p, 'Abrir regras'), 'l'],
      [3, (p) => botao(p, 'Nova turma'), 'l'],
      [4, (p) => botao(p, 'Esconder guia'), 'l'],
    ],
  },
  {
    id: 'sair', url: E,
    passos: async (p) => { await p.getByTitle('Sair da conta').click(); },
    alvo: modal,
  },

  // ============ Turmas ============
  {
    id: 'turmas', url: E,
    marcas: [
      [1, (p) => botao(p, 'Turmas'), 'l'],
      [2, (p) => p.getByTitle('Configurações'), 'l'],
      [3, (p) => botao(p, '🔗 Link'), 't'],
      [4, (p) => botao(p, '+ Nova turma'), 't'],
      [5, (p) => cartaoTurma(p, 'Terça 19h').locator('.font-semibold').first(), 'l'],
      [6, (p) => p.getByTitle('Notas').first(), 't'],
      [7, (p) => botao(p, 'Gerenciar').first(), 't'],
    ],
  },
  {
    id: 'nova-turma', url: E, alto: 1000,
    passos: async (p) => {
      await botao(p, '+ Nova turma').click();
      const m = modal(p);
      await m.locator('select').nth(0).selectOption('terça');
      await m.locator('select').nth(1).selectOption('19');
      await botao(p, '+ Adicionar outro dia').click();
      await m.locator('select').nth(3).selectOption('quinta');
      await m.locator('select').nth(4).selectOption('19');
      await m.locator('select').nth(5).selectOption('30');
      await m.getByPlaceholder('Observação').fill('Torno');
    },
    alvo: modal,
    marcas: [
      [1, (p) => modal(p).locator('select').nth(0), 'r'],
      [2, (p) => modal(p).locator('select').nth(1), 'r'],
      [3, (p) => botao(p, '+ Adicionar outro dia'), 'r'],
      [4, (p) => modal(p).getByPlaceholder('Observação'), 'r'],
      [5, (p) => botao(p, 'Criar'), 'r'],
    ],
  },
  {
    id: 'turma-aberta', url: E, alto: 1300,
    passos: async (p) => { await abrirTurma(p, 'Terça 19h'); await p.getByTitle('Legenda').click(); },
    alvo: (p) => cartaoTurma(p, 'Terça 19h'),
    marcas: [
      [1, (p) => cartaoTurma(p, 'Terça 19h').getByPlaceholder('Observação'), 'l'],
      [2, (p) => p.getByTitle('Faltas ativas'), 't'],
      [3, (p) => p.getByTitle('Legenda'), 't'],
      [4, (p) => p.getByTitle('Ver histórico').first(), 'l'],
      [5, (p) => botao(p, '+ Adicionar aluno'), 'r'],
      [6, (p) => botao(p, 'Colar lista'), 'r'],
    ],
  },
  {
    id: 'historico', url: E, alto: 1400,
    passos: async (p) => { await abrirTurma(p, 'Terça 19h'); await p.getByTitle('Ver histórico').nth(6).click(); },
    alvo: (p) => cartaoTurma(p, 'Terça 19h'), corte: 1000,
  },
  {
    id: 'adicionar-aluno', url: E, alto: 1200,
    passos: async (p) => {
      await abrirTurma(p, 'Quarta 10h');
      await botao(p, '+ Adicionar aluno').click();
      await p.getByPlaceholder('Nome do aluno').fill('Sofia Ramos');
    },
    alvo: (p) => cartaoTurma(p, 'Quarta 10h'),
    marcas: [[1, (p) => p.getByPlaceholder('Nome do aluno'), 'l'], [2, (p) => botao(p, 'OK'), 'b']],
  },
  {
    id: 'colar-lista', url: E, alto: 1300,
    passos: async (p) => {
      await abrirTurma(p, 'Quarta 10h');
      await botao(p, 'Colar lista').click();
      await p.locator('textarea').fill('1. Sofia Ramos\n2. Tomás Lima\n3. Helena Reis');
    },
    alvo: (p) => cartaoTurma(p, 'Quarta 10h'),
    marcas: [[1, (p) => p.locator('textarea'), 'r'], [2, (p) => texto(p, 'Vão entrar', false), 'l'], [3, (p) => botao(p, 'Adicionar 2'), 'r']],
  },
  {
    id: 'gerenciar', url: E, alto: 1100,
    passos: async (p) => { await botao(p, 'Gerenciar').first().click(); await modal(p).getByRole('button', { name: /Bruno Lima/ }).click(); },
    alvo: modal, corte: 560,
    marcas: [
      [1, (p) => modal(p).locator('input[type=number]').first(), 'r'],
      [2, (p) => modal(p).getByPlaceholder('Renomear…'), 'r'],
      [3, (p) => modal(p).locator('select'), 'r'],
      [4, (p) => botao(p, 'Remover aluno'), 'r'],
    ],
  },
  {
    id: 'notas', url: E, alto: 900,
    passos: async (p) => { await p.getByTitle('Notas').first().click(); },
    alvo: modal,
    marcas: [[1, (p) => p.getByPlaceholder('Escrever nota…'), 'l'], [2, (p) => botao(p, 'Salvar'), 'b'], [3, (p) => botao(p, '✏️ Editar'), 'l']],
  },
  {
    id: 'link-gerar', url: E, alto: 900,
    passos: async (p) => {
      await botao(p, '🔗 Link').click();
      await escolher(modal(p).locator('select').nth(0), 'Terça');
      await escolher(modal(p).locator('select').nth(1), 'Bruno Lima');
    },
    alvo: modal,
    marcas: [[1, (p) => modal(p).locator('select').nth(0), 'r'], [2, (p) => modal(p).locator('select').nth(1), 'r'], [3, (p) => botao(p, 'Gerar link'), 'r']],
  },
  {
    id: 'link', url: E, alto: 1200,
    passos: async (p) => {
      await botao(p, '🔗 Link').click();
      await escolher(modal(p).locator('select').nth(0), 'Terça');
      await escolher(modal(p).locator('select').nth(1), 'Marina Costa');
      await botao(p, '▦ QR code').click();
      await pausa(p, 500);
    },
    alvo: modal,
    marcas: [
      [1, (p) => modal(p).locator('.break-all'), 'r'],
      [2, (p) => botao(p, '📋 Copiar link'), 'r'],
      [3, (p) => botao(p, '↗ Abrir'), 'l'],
      [4, (p) => botao(p, '✕ Ocultar QR'), 'r'],
      [5, (p) => botao(p, 'Revogar link'), 'r'],
    ],
  },
  {
    id: 'professor', url: E, quem: 'prof',
    alvo: (p) => p.locator('header'), folga: 0,
    marcas: [[1, (p) => p.getByTitle('Sair da conta'), 'b']],
  },

  // ============ Faltas & Reposições ============
  {
    id: 'fr-visao', url: E,
    passos: async (p) => { await abaFaltas(p); await abrirGrupo(p, 0); },
    marcas: [0, 1, 2, 3, 4].map((i) => [i + 1, (p) => grupo(p, i).locator('> button > span').first(), 'r']),
  },
  {
    id: 'falta-registrar', url: E, alto: 1300,
    passos: async (p) => {
      await abaFaltas(p);
      const g = grupo(p, 0);
      await escolher(g.locator('select').nth(0), 'Terça');
      await escolher(g.locator('select').nth(1), 'Bruno Lima');
      await g.locator('input[type=checkbox]').nth(0).check();
      await g.locator('input[type=checkbox]').nth(1).check();
    },
    alvo: (p) => grupo(p, 0),
    marcas: [
      [1, (p) => grupo(p, 0).locator('select').nth(0), 'r'],
      [2, (p) => grupo(p, 0).locator('select').nth(1), 'r'],
      [3, (p) => botao(p, '⏪ Retroativas'), 'l'],
      [4, (p) => grupo(p, 0).locator('label').filter({ has: p.locator('input[type=checkbox]') }).first(), 'l'],
      [5, (p) => grupo(p, 0).getByRole('button', { name: 'Registrar Falta' }), 'r'],
    ],
  },
  {
    id: 'falta-retro', url: E, alto: 1400,
    passos: async (p) => {
      await abaFaltas(p);
      const g = grupo(p, 0);
      await escolher(g.locator('select').nth(0), 'Terça');
      await escolher(g.locator('select').nth(1), 'Diego Rocha');
      await botao(p, '⏪ Retroativas').click();
      await escolher(g.locator('select').nth(2), 1);
    },
    alvo: (p) => grupo(p, 0).locator('div.bg-amber-50.rounded-xl'), folga: 6,
    marcas: [[1, (p) => grupo(p, 0).locator('select').nth(2), 'r'], [2, (p) => botao(p, 'Comum'), 'r']],
  },
  {
    id: 'falta-ok', url: E, alto: 1300,
    passos: async (p) => {
      await abaFaltas(p);
      const g = grupo(p, 0);
      await escolher(g.locator('select').nth(0), 'Terça');
      await escolher(g.locator('select').nth(1), 'Elisa Prado');
      await g.locator('input[type=checkbox]').nth(0).check();
      await g.getByRole('button', { name: 'Registrar Falta' }).click();
      await pausa(p);
    },
    alvo: (p) => grupo(p, 0).locator('.bg-green-50'), folga: 6,
  },
  {
    id: 'falta-cancelar', url: E, alto: 1100,
    passos: async (p) => {
      await abaFaltas(p);
      const g = grupo(p, 0);
      await g.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await escolher(g.locator('select').nth(0), 'Quarta');
      await escolher(g.locator('select').nth(1), 'Helena Reis');
      await escolher(g.locator('select').nth(2), 1);
    },
    alvo: (p) => grupo(p, 0),
    marcas: [
      [1, (p) => grupo(p, 0).getByRole('button', { name: 'Cancelar', exact: true }), 'b'],
      [2, (p) => grupo(p, 0).locator('select').nth(2), 'r'],
      [3, (p) => grupo(p, 0).getByRole('button', { name: 'Cancelar Falta' }), 'r'],
    ],
  },
  {
    id: 'falta-cancelar-confirma', url: E,
    passos: async (p) => {
      await abaFaltas(p);
      const g = grupo(p, 0);
      await g.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await escolher(g.locator('select').nth(0), 'Quarta');
      await escolher(g.locator('select').nth(1), 'Helena Reis');
      await escolher(g.locator('select').nth(2), 1);
      await g.getByRole('button', { name: 'Cancelar Falta' }).click();
    },
    alvo: modal,
  },
  {
    id: 'repo-registrar', url: E, alto: 1400,
    passos: async (p) => {
      await abaFaltas(p);
      await abrirGrupo(p, 1);
      const g = grupo(p, 1);
      await escolher(g.locator('select').nth(0), 'Terça');
      await escolher(g.locator('select').nth(1), 'Bruno Lima');
      await escolher(g.locator('select').nth(2), 1);
    },
    alvo: (p) => grupo(p, 1),
    marcas: [
      [1, (p) => grupo(p, 1).locator('select').nth(0), 'r'],
      [2, (p) => grupo(p, 1).locator('select').nth(1), 'r'],
      [3, (p) => grupo(p, 1).getByText('Falta mais antiga a consumir:'), 'r'],
      [4, (p) => grupo(p, 1).locator('select').nth(2), 'r'],
      [5, (p) => grupo(p, 1).getByText('Vai consumir:', { exact: false }), 'r'],
      [6, (p) => grupo(p, 1).getByText('esperados', { exact: false }), 'r'],
      [7, (p) => grupo(p, 1).getByRole('button', { name: 'Confirmar Reposição' }), 'r'],
    ],
  },
  {
    id: 'repo-livre', url: E, alto: 1400,
    passos: async (p) => {
      await abaFaltas(p);
      await abrirGrupo(p, 1);
      const g = grupo(p, 1);
      await escolher(g.locator('select').nth(0), 'Terça');
      await escolher(g.locator('select').nth(1), 'Diego Rocha');
      await g.locator('select').nth(2).selectOption('livre');
      await g.locator('input[type=date]').fill(proximoDia(6));
      await pausa(p);
      await escolher(g.locator('select').nth(3), 'Sábado');
      await g.locator('input[value=aula_extra]').check();
    },
    alvo: (p) => grupo(p, 1),
    marcas: [
      [1, (p) => grupo(p, 1).locator('select').nth(2), 'r'],
      [2, (p) => grupo(p, 1).locator('input[type=date]'), 'r'],
      [3, (p) => grupo(p, 1).locator('select').nth(3), 'r'],
      [4, (p) => grupo(p, 1).locator('input[value=aula_extra]'), 'l'],
    ],
  },
  {
    id: 'repo-cancelar', url: E, alto: 1100,
    passos: async (p) => {
      await abaFaltas(p);
      await abrirGrupo(p, 1);
      const g = grupo(p, 1);
      await g.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await escolher(g.locator('select').nth(0), 'Marina Costa');
    },
    alvo: (p) => grupo(p, 1),
    marcas: [
      [1, (p) => grupo(p, 1).locator('select').nth(0), 'r'],
      [2, (p) => grupo(p, 1).getByText('O direito consumido volta', { exact: false }), 'r'],
      [3, (p) => grupo(p, 1).getByRole('button', { name: 'Cancelar Reposição' }), 'r'],
    ],
  },
  {
    id: 'ferias', url: E, alto: 1500,
    passos: async (p) => {
      await abaFaltas(p);
      await abrirGrupo(p, 2);
      const g = grupo(p, 2);
      await escolher(g.locator('select').nth(0), 'Quinta');
      await escolher(g.locator('select').nth(1), 'Úrsula Pinto');
      await g.locator('input[type=month]').fill(mesQueVem());
    },
    alvo: (p) => grupo(p, 2),
    marcas: [
      [1, (p) => grupo(p, 2).locator('select').nth(0), 'r'],
      [2, (p) => grupo(p, 2).locator('select').nth(1), 'r'],
      [3, (p) => grupo(p, 2).locator('input[type=month]'), 'r'],
      [4, (p) => grupo(p, 2).getByRole('button', { name: 'Registrar Ausência' }), 'r'],
      [5, (p) => grupo(p, 2).getByText('Ausências registradas'), 'r'],
    ],
  },
  {
    id: 'credito', url: E, alto: 1300,
    passos: async (p) => {
      await abaFaltas(p);
      await abrirGrupo(p, 3);
      const g = grupo(p, 3);
      await escolher(g.locator('select').nth(0), 'Terça');
      await escolher(g.locator('select').nth(1), 'Gabi Moura');
    },
    alvo: (p) => grupo(p, 3),
    marcas: [
      [1, (p) => grupo(p, 3).locator('select').nth(1), 'r'],
      [2, (p) => grupo(p, 3).locator('input[type=date]'), 'r'],
      [3, (p) => grupo(p, 3).getByRole('button', { name: 'Dar Crédito' }), 'r'],
      [4, (p) => grupo(p, 3).getByText('Créditos ativos'), 'r'],
    ],
  },
  {
    id: 'cancelar-aula', url: E, alto: 1300,
    passos: async (p) => {
      await abaFaltas(p);
      await abrirGrupo(p, 4);
      const g = grupo(p, 4);
      await escolher(g.locator('select').nth(0), 'Quinta');
      await escolher(g.locator('select').nth(1), 2);
      await g.getByRole('button', { name: 'Cancelar aula', exact: true }).click();
    },
    alvo: (p) => grupo(p, 4),
    marcas: [
      [1, (p) => grupo(p, 4).locator('select').nth(1), 'r'],
      [2, (p) => grupo(p, 4).getByText('como falta', { exact: false }), 'r'],
      [3, (p) => grupo(p, 4).getByRole('button', { name: 'Confirmar' }), 'r'],
    ],
  },

  // ============ Painel ============
  {
    id: 'painel', url: E, alto: 1700,
    passos: async (p) => { await abaPainel(p); await blocoPainel(p, 'FALTAS').click(); },
    alvo: (p) => p.locator('.max-w-4xl.mx-auto.p-4').first(),
    marcas: [
      [1, (p) => botao(p, 'Lista atual'), 'b'],
      [2, (p) => botao(p, 'Registro'), 'b'],
      [3, (p) => botao(p, '🕘 Fotos'), 'l'],
      [4, (p) => blocoPainel(p, 'FALTAS'), 'r'],
      [5, (p) => listaPainel(p).locator('.bg-amber-50').first(), 'r'],
      [6, (p) => texto(p, 'JÁ MARCADAS'), 'r'],
      [7, (p) => p.getByRole('button', { name: /RESUMO DO DIA/ }), 'r'],
    ],
  },
  {
    id: 'painel-repos', url: E, alto: 1600,
    passos: async (p) => {
      await abaPainel(p);
      await blocoPainel(p, 'REPOSIÇÕES').click();
      await blocoPainel(p, 'VAGAS').click();
    },
    alvo: listaPainel,
    marcas: [
      [1, (p) => blocoPainel(p, 'REPOSIÇÕES'), 'r'],
      [2, (p) => botao(p, 'PAGO'), 'r'],
      [3, (p) => blocoPainel(p, 'VAGAS'), 'r'],
    ],
  },
  {
    id: 'painel-obs', url: E, alto: 1600,
    passos: async (p) => {
      await abaPainel(p);
      await blocoPainel(p, 'TURMAS').click();
      await blocoPainel(p, 'OBSERVAÇÕES').click();
    },
    alvo: (p) => listaPainel(p).locator('.rounded-xl.border').filter({ hasText: 'OBSERVAÇÕES' }).first(),
  },
  {
    id: 'painel-detalhe', url: E, alto: 900,
    passos: async (p) => {
      await abaPainel(p);
      await blocoPainel(p, 'REPOSIÇÕES').click();
      await listaPainel(p).getByText('Marina Costa', { exact: true }).first().click();
    },
    alvo: modal,
  },
  {
    id: 'painel-vaga', url: E, alto: 900,
    passos: async (p) => {
      await abaPainel(p);
      await blocoPainel(p, 'VAGAS').click();
      await listaPainel(p).locator('.divide-y > div').first().click();
    },
    alvo: modal,
    marcas: [[1, (p) => modal(p).getByText('gerada', { exact: false }), 'r'], [2, (p) => botao(p, 'Ocultar vagas dos alunos'), 'r']],
  },
  {
    id: 'registro', url: E, alto: 1200,
    passos: async (p) => { await abaPainel(p); await botao(p, 'Registro').click(); },
    alvo: listaPainel, corte: 760,
    marcas: [
      [1, (p) => botao(p, '✏️ Editar'), 'l'],
      [2, (p) => listaPainel(p).locator('span.rounded-full').first(), 'b'],
      [3, (p) => listaPainel(p).getByRole('button', { name: 'Marina Costa' }).first(), 'b'],
    ],
  },
  {
    id: 'resumo', url: E, alto: 1400,
    passos: async (p) => {
      await abaPainel(p);
      await p.getByRole('button', { name: /RESUMO DO DIA/ }).click();
      for (let i = 0; i < 7; i++) {
        if (await p.getByText('Presentes', { exact: false }).count()) break;
        await p.getByLabel('Dia anterior').click();
        await pausa(p, 150);
      }
    },
    alvo: (p) => p.locator('.fade-in').filter({ has: p.getByLabel('Dia anterior') }).first(),
    marcas: [
      [1, (p) => p.getByLabel('Dia anterior'), 'b'],
      [2, (p) => p.getByLabel('Escolher data'), 'b'],
      [3, (p) => p.getByLabel('Próximo dia'), 'b'],
    ],
  },
  {
    id: 'fotos', url: E, alto: 900,
    passos: async (p) => { await abaPainel(p); await botao(p, '🕘 Fotos').click(); },
    alvo: modal,
    marcas: [[1, (p) => p.getByPlaceholder('Nome desta foto (opcional)'), 'l'], [2, (p) => botao(p, 'Salvar agora'), 'b'], [3, (p) => botao(p, 'Ver'), 'b']],
  },
  {
    id: 'foto-ver', url: E, alto: 1500,
    passos: async (p) => { await abaPainel(p); await botao(p, '🕘 Fotos').click(); await botao(p, 'Ver').click(); },
    alvo: modal, corte: 900,
  },

  // ============ Configurações ============
  { id: 'config', url: E, alto: 1200, passos: (p) => abrirConfig(p), alvo: modal },
  {
    id: 'cfg-nome', url: E, alto: 1000, passos: (p) => abrirConfig(p, 'Nome e cor'), alvo: modal,
    marcas: [[1, (p) => modal(p).getByLabel('Artigo'), 'l'], [2, (p) => modal(p).locator('input[type=color]'), 'r'], [3, (p) => botao(p, 'Salvar'), 'b']],
  },
  { id: 'cfg-vocab', url: E, alto: 1000, passos: (p) => abrirConfig(p, 'Vocabulário'), alvo: modal },
  { id: 'cfg-capacidades', url: E, alto: 1000, passos: (p) => abrirConfig(p, 'Capacidades'), alvo: modal },
  {
    id: 'cfg-calendario', url: E, alto: 1700,
    passos: async (p) => {
      await abrirConfig(p, 'Calendário');
      await botao(p, '+ Adicionar recesso').click();
      const d = modal(p).locator('input[type=date]');
      const ano = new Date().getFullYear();
      await d.nth(0).fill(`${ano}-12-21`);
      await d.nth(1).fill(`${ano + 1}-01-10`);
      await modal(p).getByPlaceholder('Nome', { exact: true }).fill('Férias de fim de ano');
      await botao(p, '+ Adicionar feriado').click();
      await d.nth(2).fill(`${ano + 1}-01-20`);
      await modal(p).getByPlaceholder('Nome do feriado').fill('São Sebastião');
    },
    alvo: modal, corte: 1000,
  },
  {
    id: 'cfg-faltas', url: E, alto: 1100,
    passos: async (p) => { await abrirConfig(p, 'Faltas'); await botao(p, 'sim').first().click(); },
    alvo: modal,
  },
  {
    id: 'cfg-vagaextra', url: E, alto: 1000, passos: (p) => abrirConfig(p, 'Vaga extra'), alvo: modal,
  },
  { id: 'cfg-ferias', url: E, alto: 1200, passos: (p) => abrirConfig(p, 'Férias'), alvo: modal },
  {
    id: 'cfg-equipe', url: E, alto: 1000, passos: (p) => abrirConfig(p, 'Professores e seu PIN'), alvo: modal,
    marcas: [
      [1, (p) => botao(p, 'trocar meu PIN'), 'l'],
      [2, (p) => botao(p, 'editar').first(), 'b'],
      [3, (p) => botao(p, 'remover').first(), 'b'],
      [4, (p) => botao(p, 'Adicionar professor'), 'l'],
    ],
  },
  {
    id: 'cfg-equipe-novo', url: E, alto: 1000,
    passos: async (p) => {
      await abrirConfig(p, 'Professores e seu PIN');
      await botao(p, 'Adicionar professor').click();
      const m = modal(p);
      await m.locator('input').nth(0).fill('Joana Prado');
      await m.locator('input[type=email]').fill('joana@barrobom.com.br');
      await m.locator('input[type=password]').fill('3691');
    },
    alvo: modal,
    marcas: [
      [1, (p) => modal(p).locator('input').nth(0), 'r'],
      [2, (p) => modal(p).locator('input[type=email]'), 'r'],
      [3, (p) => modal(p).locator('input[type=password]'), 'r'],
      [4, (p) => botao(p, 'Salvar'), 'b'],
    ],
  },
  {
    id: 'cfg-dados', url: E, alto: 1000, passos: (p) => abrirConfig(p, 'Baixar os dados'), alvo: modal,
    marcas: [[1, (p) => botao(p, 'Baixar dados (JSON)'), 'r']],
  },

  // ============ Aluno ============
  {
    id: 'aluno', url: ALUNO, quem: 'ninguem',
    marcas: [
      [1, (p) => botao(p, 'Regras'), 'b'],
      [2, (p) => p.locator('.bg-red-50').first(), 'r'],
      [3, (p) => p.locator('.bg-blue-50').first(), 'r'],
      [4, (p) => texto(p, 'Minhas faltas'), 'l'],
      [5, (p) => p.getByRole('button', { name: /Avisos/ }), 'b'],
      [6, (p) => texto(p, 'Vagas esta semana'), 'l'],
      [7, (p) => p.locator('.bg-purple-50').first(), 'r'],
    ],
  },
  {
    id: 'aluno-cartoes', url: ALUNO, quem: 'ninguem', alto: 1300,
    alvo: (p) => p.locator('.max-w-md'), corte: 1300,
  },
  {
    id: 'aluno-falta', url: ALUNO, quem: 'ninguem', alto: 1500,
    passos: async (p) => {
      await botao(p, /Registrar falta/, false).click();
      const c = cartaoAluno(p, 'Registrar falta');
      await c.locator('input[type=checkbox]:not([disabled])').nth(1).check();
    },
    alvo: (p) => cartaoAluno(p, 'Registrar falta'),
    marcas: [
      [1, (p) => cartaoAluno(p, 'Registrar falta').locator('label').nth(1), 'r'],
      [2, (p) => botao(p, 'Confirmar falta'), 'r'],
    ],
  },
  {
    id: 'aluno-falta-ok', url: ALUNO, quem: 'ninguem',
    passos: async (p) => {
      await botao(p, /Registrar falta/, false).click();
      const c = cartaoAluno(p, 'Registrar falta');
      await c.locator('input[type=checkbox]:not([disabled])').nth(1).check();
      await botao(p, 'Confirmar falta').click();
      await pausa(p, 600);
      await p.evaluate(() => window.scrollTo(0, 0));
    },
    alvo: (p) => cartaoAluno(p, 'Minhas faltas'),
    marcas: [[1, (p) => cartaoAluno(p, 'Minhas faltas').getByTitle('Cancelar falta').first(), 'r']],
  },
  {
    id: 'aluno-cancelar-falta', url: ALUNO, quem: 'ninguem',
    passos: async (p) => {
      await botao(p, /Registrar falta/, false).click();
      const c = cartaoAluno(p, 'Registrar falta');
      await c.locator('input[type=checkbox]:not([disabled])').nth(1).check();
      await botao(p, 'Confirmar falta').click();
      await pausa(p, 600);
      await cartaoAluno(p, 'Minhas faltas').getByTitle('Cancelar falta').first().click();
    },
    alvo: modal,
  },
  {
    id: 'aluno-motivo', url: ALUNO, quem: 'ninguem',
    passos: async (p) => { await cartaoAluno(p, 'Minhas faltas').locator('button[title]').nth(1).click(); },
    alvo: (p) => cartaoAluno(p, 'Minhas faltas'),
  },
  {
    id: 'aluno-repor', url: ALUNO, quem: 'ninguem', alto: 1500,
    passos: async (p) => { await botao(p, /Marcar reposição/, false).click(); },
    alvo: (p) => p.locator('#card-reposicao'),
    marcas: [[1, (p) => reporLivre(p).first(), 'l']],
  },
  {
    id: 'aluno-repor-ok', url: ALUNO, quem: 'ninguem', alto: 1500,
    passos: async (p) => {
      await botao(p, /Marcar reposição/, false).click();
      await reporLivre(p).first().click();
      await pausa(p, 600);
    },
    alvo: (p) => p.locator('.bg-green-50').last(), folga: 6,
  },
  {
    id: 'aluno-credito', url: ALUNO, quem: 'ninguem', alto: 1500,
    passos: async (p) => {
      await botao(p, /Marcar reposição/, false).click();
      await reporLivre(p).first().click();
      await pausa(p, 600);
      await botao(p, /Marcar reposição/, false).click();
      await p.locator('#card-reposicao button:not([disabled])').filter({ hasText: 'Repor (crédito)' }).first().click();
    },
    alvo: modal,
  },
  {
    id: 'aluno-minhas', url: ALUNO, quem: 'ninguem', alto: 1500,
    passos: async (p) => { await botao(p, /Minhas reposições/, false).click(); },
    alvo: (p) => cartaoAluno(p, 'Minhas reposições'),
    marcas: [[1, (p) => cartaoAluno(p, 'Minhas reposições').getByRole('button', { name: 'Cancelar' }), 'l']],
  },
  {
    id: 'aluno-ferias', url: ALUNO, quem: 'ninguem', alto: 1600,
    passos: async (p) => {
      await p.getByRole('button', { name: /Registre uma ausência/ }).click();
      await escolher(cartaoAluno(p, 'Férias').locator('select'), 2);
    },
    alvo: (p) => cartaoAluno(p, 'Férias'),
    marcas: [[1, (p) => cartaoAluno(p, 'Férias').locator('select'), 'r'], [2, (p) => botao(p, 'Confirmar férias'), 'r']],
  },
  {
    id: 'aluno-regras', url: ALUNO, quem: 'ninguem', alto: 1500,
    passos: async (p) => { await botao(p, 'Regras').click(); },
    alvo: folha,
  },
  {
    id: 'aluno-avisos', url: ALUNO, quem: 'ninguem', permissoes: ['notifications'],
    passos: async (p) => {
      await p.getByRole('button', { name: /Avisos/ }).click();
      await folha(p).getByRole('button', { name: /Quarta 10h/ }).click();
      await pausa(p, 500);
    },
    alvo: folha,
    marcas: [[1, (p) => folha(p).getByRole('button', { name: /Quarta 10h/ }), 'r']],
  },
];

// Janelas saem sem folga: o recorte fica justo na borda delas.
for (const c of CENAS) if ((c.alvo === modal || c.alvo === folha) && c.folga === undefined) c.folga = 0;
