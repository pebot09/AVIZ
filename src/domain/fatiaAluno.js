// Fatia do aluno — o que um aluno pode ver e fazer.
//
// No Passarinho o navegador do aluno tinha o banco inteiro: lia tudo de todo
// mundo e escrevia com um segredo compartilhado. Num produto vendido para
// várias escolas isso não serve. Aqui o aluno recebe só uma projeção: as
// coisas dele, mais o mínimo de contexto para escolher uma vaga.
//
// Este arquivo é puro de propósito: é o mesmo código que roda no servidor
// (onde a fatia é montada e as ações são validadas) e nos testes. A tela do
// aluno consome só a fatia — nunca o estado da escola.

import { arr, todayStr, turmaShortLabel, getTurmaLabel, TURMA_EXTRA_ID } from './helpers.js';
import { getClassDatetime, getClassDatesInRange, turmaOcorreEm, isFeriado, isRecesso } from './calendario.js';
import { reposicaoRights, ausenciaExpiry } from './reposicao.js';

// ---- Projeção ----
//
// Regra de ouro: nada aqui pode revelar quem são os outros alunos. Vaga vira
// data+turma; de quem ela veio fica no servidor. A única exceção é a própria
// ausência do aluno, que ele já sabe que é dele.
export function fatiaAluno(state, config, acesso) {
  const { alunoNome, turmaId } = acesso;
  const td = todayStr();

  const meuFiltro = (x) => x.alunoNome === alunoNome && x.turmaId === turmaId;

  // Turmas: só o necessário para rotular e calcular horário. Sem alunos.
  const turmas = arr(state.turmas).map((t) => ({
    id: t.id,
    encontros: arr(t.encontros).length ? t.encontros : (t.diaSemana ? [{ diaSemana: t.diaSemana, hora: t.hora, minuto: t.minuto, horario: t.horario }] : []),
    observacao: t.observacao || '',
  }));

  // Vagas futuras e não ocultadas. Sem faltaId (é de outro aluno); ausenciaId
  // só sobrevive se for de uma ausência do próprio aluno, para ele reconhecer
  // "a vaga das minhas férias".
  const minhasAusenciasIds = new Set(arr(state.ausencias).filter(meuFiltro).map((a) => a.id));
  const vagas = arr(state.vagas)
    .filter((v) => v.data >= td && !v.cancelada)
    .map((v) => ({
      id: v.id,
      turmaId: v.turmaId,
      data: v.data,
      vagaExtra: !!v.vagaExtra,
      ...(minhasAusenciasIds.has(v.ausenciaId) ? { ausenciaId: v.ausenciaId } : {}),
    }));

  const faltas = arr(state.faltas).filter(meuFiltro).map((f) => ({
    id: f.id, alunoNome: f.alunoNome, turmaId: f.turmaId, datas: arr(f.datas),
    status: f.status, semAntecedencia: !!f.semAntecedencia,
    reposicaoId: f.reposicaoId || null,
    // O aluno precisa saber que esta falta veio de aula cancelada pela escola:
    // é o que explica o ✕ desabilitado.
    cancelamentoId: f.cancelamentoId || null,
  }));

  const reposicoes = arr(state.reposicoes)
    .filter((r) => r.alunoNome === alunoNome && r.turmaOrigemId === turmaId)
    .map((r) => ({
      id: r.id, alunoNome: r.alunoNome, turmaOrigemId: r.turmaOrigemId,
      turmaReposicaoId: r.turmaReposicaoId, dataReposicao: r.dataReposicao,
      realizada: !!r.realizada, tipo: r.tipo || 'reposicao',
      faltaId: r.faltaId || null, ausenciaId: r.ausenciaId || null,
      vagaConsumedFaltaId: r.vagaConsumedFaltaId || null,
      vagaConsumedAusenciaId: r.vagaConsumedAusenciaId || null,
    }));

  const ausencias = arr(state.ausencias).filter(meuFiltro);
  const creditos = arr(state.creditos).filter(meuFiltro);

  // Datas de aula do mês de cada ausência, para o aluno ver o que liberou.
  // Quem ocupou a vaga não vai — é nome de outro aluno.
  const turmaObj = arr(state.turmas).find((t) => t.id === turmaId);
  const ausenciasDetalhe = ausencias.map((a) => {
    const [y, m] = a.mesAno.split('-').map(Number);
    const primeiro = `${a.mesAno}-01`;
    const ultimo = `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    const datas = turmaObj ? getClassDatesInRange(turmaObj, primeiro, ultimo) : [];
    return {
      ...a,
      expira: ausenciaExpiry(a, config),
      datasLiberadas: datas.map((data) => ({
        data,
        bloqueada: isFeriado(data, config) || isRecesso(data, config),
        // "consumida" = não há mais vaga aberta daquela ausência naquela data.
        consumida: !arr(state.vagas).some((v) => v.ausenciaId === a.id && v.data === data),
      })),
    };
  });

  const acessoObj = arr(state.acessos).find((x) => x.alunoNome === alunoNome && x.turmaId === turmaId);

  return {
    aluno: { nome: alunoNome, turmaId },
    turmaLabel: turmaObj ? (turmaObj.id === TURMA_EXTRA_ID ? 'Extra' : getTurmaLabel(state.turmas, turmaId)) : '?',
    turmaCurta: turmaObj ? turmaShortLabel(turmaObj) : '?',
    turmas, vagas, faltas, reposicoes, ausencias: ausenciasDetalhe, creditos,
    watchlist: arr(acessoObj && acessoObj.watchlist),
    aulasCanceladas: arr(state.aulasCanceladas).map((a) => ({ turmaId: a.turmaId, data: a.data })),
    geradaEm: Date.now(),
  };
}

// ---- Pode cancelar esta falta? ----
//
// Portado do getCancelFaltaStatus do Passarinho, mais a trava de aula
// cancelada que combinamos (PLANTA 2.2/2.5). O ✕ fica desabilitado com o
// motivo à vista; não some.
export function getCancelFaltaStatus(falta, fatia, config) {
  const data = arr(falta.datas)[0];

  if (falta.cancelamentoId) {
    return { pode: false, motivo: 'Esta falta veio de uma aula cancelada pela escola. Ela só é desfeita se a aula for reativada.' };
  }
  if (falta.status === 'marcada') {
    return { pode: false, motivo: 'Você já tem uma reposição marcada para esta falta. Cancele a reposição primeiro.' };
  }
  const inicio = getClassDatetime(falta.turmaId, data, fatia.turmas);
  if (inicio && Date.now() >= inicio.getTime()) {
    return { pode: false, motivo: 'O horário desta aula já passou.' };
  }
  // A vaga que esta falta abriu já foi ocupada? Só dá para desfazer se houver
  // outra vaga na mesma turma/data para ficar no lugar dela.
  const minhaVaga = fatia.vagas.some((v) => v.turmaId === falta.turmaId && v.data === data && !v.vagaExtra);
  if (!minhaVaga) {
    const outra = fatia.vagas.some((v) => v.turmaId === falta.turmaId && v.data === data);
    if (!outra) {
      return { pode: false, motivo: 'Sua vaga já foi ocupada por outra pessoa e não há outra disponível para substituir.' };
    }
  }
  return { pode: true, motivo: null };
}

// ---- Janela para registrar falta numa data ----
//
// No Passarinho os limites eram fixos (22h e 2h). Aqui vêm do config:
// antecedenciaHoras é o prazo da falta comum, e semAntecedenciaJanela é a
// janela em que a reposição de uma falta sem antecedência pode ser marcada —
// também o piso abaixo do qual não se registra mais falta.
export function statusDataFalta(turmaId, data, fatia, config, agora = Date.now()) {
  const inicio = getClassDatetime(turmaId, data, fatia.turmas);
  if (!inicio) return 'normal';
  const horas = (inicio.getTime() - agora) / 3600000;
  const prazo = Number(config?.regras?.antecedenciaHoras) || 0;
  const permiteSemAntec = !!config?.regras?.semAntecedencia && prazo > 0;
  const janela = Number(config?.regras?.semAntecedenciaJanela) || 0;

  if (horas <= 0) return 'encerrado';
  if (!prazo) return 'normal'; // escola sem exigência de antecedência
  if (horas > prazo) return 'normal';
  if (!permiteSemAntec) return 'encerrado';
  if (horas > janela) return 'semAntecedencia';
  return 'encerrado';
}

// ---- Faixa de cancelamento de uma reposição ----
//
// Três faixas, como no original, mas com os limites do config:
//   > antecedenciaHoras  → devolve o direito
//   > janela             → devolve, mas a falta volta como "sem antecedência"
//   <= janela            → cancela sem devolver nada
export function faixaCancelamentoRepo(repo, fatia, config, agora = Date.now()) {
  const inicio = getClassDatetime(repo.turmaReposicaoId, repo.dataReposicao, fatia.turmas);
  const horas = inicio ? (inicio.getTime() - agora) / 3600000 : Infinity;
  const prazo = Number(config?.regras?.antecedenciaHoras) || 0;
  const janela = Number(config?.regras?.semAntecedenciaJanela) || 0;
  if (horas <= janela) return 'semCredito';
  if (prazo && horas < prazo) return 'semAntecedencia';
  return 'devolve';
}

// ---- Direitos do aluno, já na forma que a tela usa ----
export function direitosDoAluno(fatia, config, td = todayStr()) {
  return reposicaoRights(
    { faltas: fatia.faltas, ausencias: fatia.ausencias, creditos: fatia.creditos },
    fatia.aluno.nome, fatia.aluno.turmaId, td, config,
  );
}

// ---- Meses que o aluno ainda pode marcar como férias ----
export function mesesDeFeriasDisponiveis(fatia, config, hoje = new Date()) {
  if (!config?.regras?.ferias) return [];
  const limiteAno = config.regras.feriasLimiteAno;
  const meses = [];
  for (let i = 0; i <= 5; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const mesAno = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const ano = mesAno.slice(0, 4);
    const noAno = fatia.ausencias.filter((a) => a.mesAno.slice(0, 4) === ano).length;
    const jaTemEsteMes = fatia.ausencias.some((a) => a.mesAno === mesAno);
    if (jaTemEsteMes) continue;
    if (limiteAno && noAno >= Number(limiteAno)) continue;
    meses.push(mesAno);
  }
  return meses;
}

// ---- Vagas que o aluno pode escolher ----
// Uma por turma+data (a primeira serve), sem as que a aula já começou.
export function vagasParaAluno(fatia, agora = Date.now()) {
  const vistas = new Set();
  return [...fatia.vagas]
    .filter((v) => {
      const inicio = getClassDatetime(v.turmaId, v.data, fatia.turmas);
      if (inicio && inicio.getTime() <= agora) return false;
      // Aula cancelada não recebe reposição.
      if (fatia.aulasCanceladas.some((a) => a.turmaId === v.turmaId && a.data === v.data)) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.data !== b.data) return a.data.localeCompare(b.data);
      const ia = getClassDatetime(a.turmaId, a.data, fatia.turmas);
      const ib = getClassDatetime(b.turmaId, b.data, fatia.turmas);
      return (ia ? ia.getTime() : 0) - (ib ? ib.getTime() : 0);
    })
    .filter((v) => {
      const chave = `${v.data}|${v.turmaId}`;
      if (vistas.has(chave)) return false;
      vistas.add(chave);
      return true;
    });
}

// ---- Datas em que o aluno ainda pode registrar falta ----
export function proximasDatasDoAluno(fatia, config, n = 8) {
  const turma = fatia.turmas.find((t) => t.id === fatia.aluno.turmaId);
  if (!turma || !arr(turma.encontros).length) return [];
  const datas = [];
  const d = new Date(); d.setHours(0, 0, 0, 0);
  for (let i = 0; datas.length < n && i < 400; i++, d.setDate(d.getDate() + 1)) {
    if (!turmaOcorreEm(turma, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)) continue;
    datas.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return datas;
}

// ---- Ações que o aluno pode pedir ----
//
// Lista fechada: o servidor só aceita estas, e sempre carimbando o nome e a
// turma vindos do código de acesso — nunca os que o cliente mandar. Sem isso,
// bastaria trocar o alunoNome no corpo do pedido para agir por outra pessoa.
export const ACOES_DO_ALUNO = new Set([
  'ADD_FALTA', 'CANCEL_FALTA',
  'ADD_REPOSICAO', 'CANCEL_REPOSICAO', 'CANCEL_REPOSICAO_SEM_CREDITO',
  'ADD_AUSENCIA', 'SET_ALUNO_WATCHLIST',
]);

// Valida e reescreve a ação do aluno com a identidade do código de acesso.
// Devolve { ok, acao } ou { ok: false, erro }.
export function acaoDoAluno(pedido, acesso, state, config) {
  if (!pedido || !ACOES_DO_ALUNO.has(pedido.type)) {
    return { ok: false, erro: 'Ação não permitida.' };
  }
  const { alunoNome, turmaId } = acesso;
  const base = { ...pedido, alunoNome, origem: 'aluno', professor: alunoNome };

  // Só pode mexer no que é dele. Conferimos contra o estado, não contra o que
  // veio no pedido.
  const meuId = (lista, id) => arr(lista).some((x) => x.id === id && x.alunoNome === alunoNome);

  switch (pedido.type) {
    case 'ADD_FALTA':
    case 'ADD_AUSENCIA':
      return { ok: true, acao: { ...base, turmaId } };

    case 'SET_ALUNO_WATCHLIST':
      return { ok: true, acao: { ...base, turmaId, watchlist: arr(pedido.watchlist) } };

    case 'CANCEL_FALTA': {
      const falta = arr(state.faltas).find((f) => f.id === pedido.id);
      if (!falta || falta.alunoNome !== alunoNome || falta.turmaId !== turmaId) {
        return { ok: false, erro: 'Esta falta não é sua.' };
      }
      if (falta.cancelamentoId) {
        return { ok: false, erro: 'Falta de aula cancelada pela escola não pode ser cancelada.' };
      }
      return { ok: true, acao: base };
    }

    case 'ADD_REPOSICAO':
      return { ok: true, acao: { ...base, turmaOrigemId: turmaId } };

    case 'CANCEL_REPOSICAO':
    case 'CANCEL_REPOSICAO_SEM_CREDITO': {
      if (!meuId(state.reposicoes, pedido.id)) return { ok: false, erro: 'Esta reposição não é sua.' };
      return { ok: true, acao: base };
    }

    default:
      return { ok: false, erro: 'Ação não permitida.' };
  }
}
