import { useEffect, useMemo, useRef, useState } from 'react';
import {
  arr, fmtBR, fmtBRFull, todayStr, dateToStr, parseDate,
  turmaShortLabel, getTurmaLabel, getFaltaExpiry, getMesNome, MESES_PT, TURMA_EXTRA_ID,
} from '../../domain/helpers.js';
import { getClassDatetime, getDiaSemanaFromDateStr, feriadoNome, recessoNome } from '../../domain/calendario.js';
import { pickReposicaoRight, rightToActionFields, ausenciaExpiry } from '../../domain/reposicao.js';
import {
  getCancelFaltaStatus, statusDataFalta, faixaCancelamentoRepo,
  direitosDoAluno, mesesDeFeriasDisponiveis, vagasParaAluno, proximasDatasDoAluno,
} from '../../domain/fatiaAluno.js';
import { cap } from '../../domain/vocab.js';
import ConfirmModal from '../ConfirmModal.jsx';
import RegrasModal from './RegrasModal.jsx';

// Tela do aluno — porte do AlunoView do Passarinho.
//
// Diferenças estruturais: o aluno não vê o estado da escola, só a fatia dele
// (ver domain/fatiaAluno.js), e toda ação vai pelo servidor, que carimba a
// identidade a partir do código de acesso. Todo prazo que era fixo no original
// (22h, 2h, 24h, 30 dias, julho/dezembro/janeiro) vem do config.
export default function AlunoApp({ fatia, config, vocab, nomeEscola, executar, ocupado, erro }) {
  const td = todayStr();
  const { nome: alunoNome, turmaId } = fatia.aluno;
  const ehExtra = turmaId === TURMA_EXTRA_ID;

  const [aberto, setAberto] = useState({ falta: false, reposicao: false, minhas: false, ferias: false });
  const alternar = (k) => setAberto((o) => ({ ...o, [k]: !o[k] }));
  const [verRegras, setVerRegras] = useState(false);
  const [sucesso, setSucesso] = useState('');
  const avisar = (msg, fechar) => {
    setSucesso(msg);
    if (fechar) setAberto((o) => ({ ...o, [fechar]: false }));
    setTimeout(() => setSucesso(''), 4000);
  };

  const horasPrazo = Number(config?.regras?.antecedenciaHoras) || 0;
  const janela = Number(config?.regras?.semAntecedenciaJanela) || 0;

  // ---- Direitos e créditos ----
  const direitos = useMemo(() => direitosDoAluno(fatia, config, td), [fatia, config, td]);
  const ausenciaCredito = useMemo(
    () => fatia.ausencias.find((a) => !a.creditoUsado && a.creditoReposicao > 0) || null,
    [fatia.ausencias],
  );
  const creditosExtras = useMemo(
    () => fatia.creditos.filter((c) => !c.usado && c.dataExpiracao >= td),
    [fatia.creditos, td],
  );
  const faltasPendentes = useMemo(
    () => fatia.faltas.filter((f) => f.status === 'pendente'),
    [fatia.faltas],
  );
  const temPendenteComum = faltasPendentes.some((f) => !f.semAntecedencia);

  // ---- Vagas ----
  const vagas = useMemo(() => vagasParaAluno(fatia), [fatia]);
  const emSeis = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 6); return dateToStr(d); }, []);
  const vagasSemana = vagas.filter((v) => v.data <= emSeis);

  // Falta sem antecedência só vira reposição dentro da janela final. Então
  // "tenho direito" depende de existir alguma vaga nessa janela — senão o
  // cartão prometeria "Marcar reposição" e todo botão diria "aula extra".
  const algumaNaJanela = vagas.some((v) => {
    const inicio = getClassDatetime(v.turmaId, v.data, fatia.turmas);
    if (!inicio) return false;
    const h = (inicio.getTime() - Date.now()) / 3600000;
    return h >= 0 && h <= janela;
  });
  const temDireitoUsavel = !!pickReposicaoRight(direitos, algumaNaJanela);

  // ---- Registrar falta ----
  const proximasDatas = useMemo(() => (ehExtra ? [] : proximasDatasDoAluno(fatia, config, 8)), [fatia, config, ehExtra]);
  const [datasSel, setDatasSel] = useState([]);
  const statusData = (d) => statusDataFalta(turmaId, d, fatia, config);
  const marcarData = (d) => {
    if (statusData(d) === 'encerrado') return;
    setDatasSel((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));
  };
  const registrarFalta = async () => {
    if (!datasSel.length) return;
    const datasComTipo = datasSel.map((d) => ({ data: d, semAntecedencia: statusData(d) === 'semAntecedencia' }));
    const ok = await executar({ type: 'ADD_FALTA', datasComTipo });
    if (ok) { setDatasSel([]); avisar('Falta registrada!', 'falta'); }
  };

  // ---- Marcar reposição ----
  const [confirmar, setConfirmar] = useState(null); // { tipo, vaga, direito }
  const marcarRepo = async (vaga, direito) => {
    const ok = await executar({
      type: 'ADD_REPOSICAO',
      dataReposicao: vaga.data, turmaReposicaoId: vaga.turmaId,
      semVagaOficial: false, vagaSelId: vaga.id,
      ...rightToActionFields(direito),
    });
    // Fecha o modal mesmo em caso de erro: senão ele cobre a mensagem que
    // explica por que não deu.
    setConfirmar(null);
    if (ok) avisar(direito ? 'Reposição marcada!' : `${cap(vocab.aula)} extra marcada!`, 'reposicao');
  };

  // ---- Minhas reposições ----
  const minhasRepos = useMemo(
    () => fatia.reposicoes.filter((r) => !r.realizada).sort((a, b) => a.dataReposicao.localeCompare(b.dataReposicao)),
    [fatia.reposicoes],
  );
  const [cancelarRepo, setCancelarRepo] = useState(null); // { repo, faixa }
  const confirmarCancelRepo = async () => {
    const { repo, faixa } = cancelarRepo;
    const acao = faixa === 'semCredito'
      ? { type: 'CANCEL_REPOSICAO_SEM_CREDITO', id: repo.id }
      : { type: 'CANCEL_REPOSICAO', id: repo.id, converterSemAntecedencia: faixa === 'semAntecedencia' };
    // Fecha mesmo em erro, pelo mesmo motivo: o modal cobriria a mensagem.
    setCancelarRepo(null);
    await executar(acao);
  };

  // ---- Cancelar falta ----
  const [cancelarFalta, setCancelarFalta] = useState(null);
  const [motivoFalta, setMotivoFalta] = useState(null); // { faltaId, motivo }

  // ---- Férias ----
  const [mesFerias, setMesFerias] = useState('');
  const mesesFerias = useMemo(() => mesesDeFeriasDisponiveis(fatia, config), [fatia, config]);
  const registrarFerias = async () => {
    if (!mesFerias) return;
    const ok = await executar({ type: 'ADD_AUSENCIA', tipo: 'ferias', mesAno: mesFerias });
    if (ok) { setMesFerias(''); avisar('Férias registradas!', 'ferias'); }
  };

  // ---- Avisos de vaga ----
  const [verNotif, setVerNotif] = useState(false);
  const notificar = useNotificacoesDeVaga(fatia, faltasPendentes.length > 0);

  // ---- Alertas do topo ----
  const emSete = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 7); return dateToStr(d); }, []);
  const haVinte = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 20); return dateToStr(d); }, []);
  const alertas = [];
  faltasPendentes.forEach((f) => {
    const exp = getFaltaExpiry(f, config);
    if (exp >= td && exp <= emSete) {
      const dias = Math.round((parseDate(exp) - parseDate(td)) / 86400000);
      const quando = dias <= 0 ? 'hoje' : dias === 1 ? 'em 1 dia' : `em ${dias} dias`;
      alertas.push({ nivel: 'red', texto: `Falta de ${fmtBR(f.datas[0])} expira ${quando} — marque uma reposição!` });
    }
    if (exp < td && exp >= haVinte) alertas.push({ nivel: 'expirado', texto: `Falta de ${fmtBR(f.datas[0])} expirou em ${fmtBRFull(exp)}.` });
  });
  minhasRepos
    .filter((r) => (parseDate(r.dataReposicao) - Date.now()) <= 7 * 86400000)
    .forEach((r) => alertas.push({
      nivel: 'blue',
      texto: `Reposição em ${fmtBRFull(r.dataReposicao)} às ${horaDe(r.turmaReposicaoId, r.dataReposicao, fatia)}`,
    }));

  const corAlerta = { red: 'bg-red-50 border-red-200 text-red-700', blue: 'bg-blue-50 border-blue-200 text-blue-700', expirado: 'bg-gray-50 border-gray-200 text-gray-500' };
  const iconeAlerta = { red: '⚠️', blue: '📅', expirado: '💨' };

  const minhasFaltas = useMemo(
    () => fatia.faltas.filter((f) => f.status === 'pendente' || f.status === 'marcada')
      .sort((a, b) => a.datas[0].localeCompare(b.datas[0])),
    [fatia.faltas],
  );

  const rotuloTurma = (id) => turmaShortLabel(fatia.turmas.find((t) => t.id === id)) || '?';

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-40 gap-2">
        <div className="min-w-0">
          <div className="text-xs text-gray-400 truncate">{nomeEscola}</div>
          <div className="font-bold text-gray-900 text-lg leading-tight truncate">Olá, {alunoNome} 👋</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => setVerRegras(true)} className="text-xs text-amber-700 border border-amber-300 bg-amber-50 px-2.5 py-1 rounded-lg font-medium hover:bg-amber-100 transition-colors">Regras</button>
          <div className="text-right">
            <div className="text-xs text-gray-400">Sua {vocab.turma}</div>
            <div className="text-sm font-semibold text-gray-700">{fatia.turmaLabel}</div>
          </div>
        </div>
      </header>

      {verRegras && <RegrasModal config={config} vocab={vocab} onClose={() => setVerRegras(false)} />}

      <div className="max-w-md mx-auto p-4 space-y-4">
        {erro && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{erro}</div>}

        {/* Alertas */}
        {alertas.length > 0 && (
          <div className="space-y-2">
            {alertas.map((a, i) => (
              <div key={i} className={`border rounded-xl px-4 py-3 flex items-start gap-3 ${corAlerta[a.nivel]}`}>
                <div className="text-lg mt-0.5">{iconeAlerta[a.nivel]}</div>
                <div className="text-sm font-medium">{a.texto}</div>
              </div>
            ))}
          </div>
        )}

        {/* Minhas faltas */}
        {minhasFaltas.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
              <div className="font-semibold text-gray-800 text-sm">Minhas faltas</div>
              <div className="flex items-center gap-3">
                <button onClick={() => setVerNotif(true)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${fatia.watchlist.length ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                  {fatia.watchlist.length ? '🔔' : '🔕'} Avisos
                </button>
                <div className="text-xs text-gray-400">{minhasFaltas.length} falta{minhasFaltas.length > 1 ? 's' : ''}</div>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {minhasFaltas.map((f) => {
                const exp = getFaltaExpiry(f, config);
                const expirando = exp >= td && exp <= emSete;
                const repo = f.status === 'marcada' && f.reposicaoId ? fatia.reposicoes.find((r) => r.id === f.reposicaoId) : null;
                const podeCancelar = getCancelFaltaStatus(f, fatia, config);
                const mostrandoMotivo = motivoFalta?.faltaId === f.id;
                return (
                  <div key={f.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <div className="font-medium text-gray-800 text-sm">{fmtBRFull(f.datas[0])}</div>
                        {f.semAntecedencia && <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">sem antecedência</span>}
                        {f.cancelamentoId && <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">{vocab.aula} cancelada</span>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {repo?.realizada
                          ? <span className="text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Reposta</span>
                          : f.status === 'marcada'
                            ? <span className="text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">Marcada</span>
                            : <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">A marcar</span>}
                        <button
                          onClick={() => {
                            if (podeCancelar.pode) { setMotivoFalta(null); setCancelarFalta(f); }
                            else setMotivoFalta(mostrandoMotivo ? null : { faltaId: f.id, motivo: podeCancelar.motivo });
                          }}
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${podeCancelar.pode ? 'text-red-400 hover:text-white hover:bg-red-500 border border-red-200 hover:border-red-500' : 'text-gray-300 border border-gray-200'}`}
                          title={podeCancelar.pode ? 'Cancelar falta' : podeCancelar.motivo}
                        >✕</button>
                      </div>
                    </div>
                    {repo
                      ? <div className="text-xs text-gray-500 mt-0.5">Reposição: {fmtBRFull(repo.dataReposicao)} ({rotuloTurma(repo.turmaReposicaoId)})</div>
                      : <div className={`text-xs mt-0.5 ${expirando ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                          {expirando ? '⚠️ ' : ''}{getFaltaExpiry(f, config) === '9999-12-31' ? 'Sem prazo para repor' : `Expira em ${fmtBRFull(exp)}`}
                        </div>}
                    {mostrandoMotivo && (
                      <div className="mt-1.5 text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5 leading-snug">{motivoFalta.motivo}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Vagas desta semana (atalho) */}
        {vagasSemana.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer"
            onClick={() => { setAberto((o) => ({ ...o, reposicao: true })); setTimeout(() => document.getElementById('card-reposicao')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}>
            <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <div className="font-semibold text-gray-700 text-xs uppercase tracking-wide">Vagas esta semana</div>
              <div className="text-xs text-gray-400">{vagasSemana.length} vaga{vagasSemana.length > 1 ? 's' : ''} →</div>
            </div>
            <div className="px-3 py-2 flex flex-wrap gap-2">
              {vagasSemana.map((v) => (
                <span key={v.id} className="text-xs font-medium text-gray-600 bg-gray-100 rounded-lg px-2.5 py-1">
                  {fmtBR(v.data).slice(0, 5)} · {rotuloTurma(v.turmaId)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Créditos */}
        {ausenciaCredito && !ehExtra && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <div className="text-xl shrink-0">🏖️</div>
            <div className="min-w-0">
              <div className="font-semibold text-teal-800 text-sm">
                Você tem {ausenciaCredito.creditoReposicao} crédito{ausenciaCredito.creditoReposicao > 1 ? 's' : ''} de reposição de férias
              </div>
              <div className="text-xs text-teal-700 mt-0.5">Férias de {getMesNome(ausenciaCredito.mesAno)} — expira em {fmtBRFull(ausenciaExpiry(ausenciaCredito, config))}</div>
              <div className="text-xs text-teal-600 mt-1">Abra "Marcar reposição" abaixo para usar.</div>
            </div>
          </div>
        )}
        {creditosExtras.length > 0 && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <div className="text-xl shrink-0">🎟️</div>
            <div className="min-w-0">
              <div className="font-semibold text-purple-800 text-sm">Você tem {creditosExtras.length} crédito{creditosExtras.length > 1 ? 's' : ''} de reposição extra</div>
              <div className="text-xs text-purple-700 mt-0.5">Expira em {fmtBRFull(creditosExtras[0].dataExpiracao)}</div>
              <div className="text-xs text-purple-600 mt-1">Abra "Marcar reposição" abaixo para usar.</div>
            </div>
          </div>
        )}

        {/* Registrar falta */}
        {!ehExtra && (
          <Cartao icone="🙋" titulo="Registrar falta"
            sub={horasPrazo ? `Avise com pelo menos ${horasPrazo}h de antecedência` : `Avise antes da ${vocab.aula} começar`}
            aberto={aberto.falta} onToggle={() => alternar('falta')}>
            {proximasDatas.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Nenhuma {vocab.aula} disponível para registrar falta.</p>
            ) : (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-gray-600">Quais {vocab.aulas} você vai faltar?</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {proximasDatas.map((d) => {
                    const fer = feriadoNome(d, config);
                    const rec = !fer ? recessoNome(d, config) : null;
                    const jaFalta = !fer && !rec && fatia.faltas.some((f) => arr(f.datas).includes(d) && (f.status === 'pendente' || f.status === 'marcada'));
                    if (jaFalta) return null;
                    const emFerias = fatia.ausencias.some((a) => a.mesAno === d.slice(0, 7));
                    const st = fer || rec ? 'bloqueado' : emFerias ? 'ferias' : statusData(d);
                    const sel = datasSel.includes(d);
                    const rotulo = fmtBR(d).slice(0, 5);
                    if (st === 'bloqueado') return (
                      <Chip key={d} desabilitado>
                        {rotulo} <span className={`text-xs ${fer ? 'text-purple-500' : 'text-amber-600'}`}>{fer ? `🎌 ${fer}` : `🏠 ${rec}`}</span>
                      </Chip>
                    );
                    if (st === 'ferias') return <Chip key={d} desabilitado tom="teal">{rotulo} <span className="text-xs">🏖️ férias</span></Chip>;
                    if (st === 'encerrado') return <Chip key={d} desabilitado>{rotulo} <span className="text-xs">⛔</span></Chip>;
                    if (st === 'semAntecedencia') return (
                      <Chip key={d} tom="orange" sel={sel} onClick={() => marcarData(d)}>
                        {rotulo} <span className="text-xs text-orange-500">⏱️</span>
                      </Chip>
                    );
                    return <Chip key={d} sel={sel} onClick={() => marcarData(d)}>{rotulo}</Chip>;
                  })}
                </div>
                {config?.regras?.semAntecedencia && horasPrazo > 0 && (
                  <div className="text-xs text-gray-400">⏱️ laranja = só sem antecedência &nbsp;·&nbsp; ⛔ = prazo encerrado</div>
                )}
                <button onClick={registrarFalta} disabled={!datasSel.length || ocupado}
                  className="w-full py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold disabled:opacity-40">
                  {ocupado ? 'Enviando…' : 'Confirmar falta'}
                </button>
              </div>
            )}
          </Cartao>
        )}

        {/* Marcar reposição / aula extra */}
        <div id="card-reposicao">
          <Cartao
            icone={temDireitoUsavel ? '✅' : '➕'}
            titulo={temDireitoUsavel ? 'Marcar reposição' : `Marcar ${vocab.aula} extra`}
            sub={ausenciaCredito && !temPendenteComum ? 'Usando crédito de férias'
              : creditosExtras.length && !temPendenteComum ? 'Usando crédito extra'
                : 'Escolha uma vaga disponível'}
            aberto={aberto.reposicao} onToggle={() => alternar('reposicao')} semPadding>
            {ausenciaCredito && !temPendenteComum && (
              <div className="px-4 py-2 bg-teal-50 border-b border-teal-100 text-xs text-teal-700 font-medium">
                🎫 Crédito de férias disponível — escolha uma vaga abaixo
              </div>
            )}
            {creditosExtras.length > 0 && !temPendenteComum && !ausenciaCredito && (
              <div className="px-4 py-2 bg-purple-50 border-b border-purple-100 text-xs text-purple-700 font-medium">
                🎟️ Crédito extra disponível — escolha uma vaga abaixo
              </div>
            )}
            {vagas.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400 italic">Nenhuma vaga disponível no momento.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {vagas.map((v) => {
                  const jaTenho = fatia.reposicoes.some((r) => !r.realizada && r.dataReposicao === v.data && r.turmaReposicaoId === v.turmaId);
                  const inicio = getClassDatetime(v.turmaId, v.data, fatia.turmas);
                  const horasAte = inicio ? (inicio.getTime() - Date.now()) / 3600000 : null;
                  const dentroJanela = horasAte !== null && horasAte >= 0 && horasAte <= janela;
                  const direito = pickReposicaoRight(direitos, dentroJanela);
                  const minhaVagaFerias = !!v.ausenciaId;
                  const esperandoSemAntec = !direito && direitos.some((r) => r.kind === 'falta' && r.semAntecedencia) && !dentroJanela;
                  const clique = () => {
                    if (jaTenho || ocupado) return;
                    // Dentro da janela final, marcar e depois cancelar queima o
                    // direito — o original avisava, e o aviso continua valendo.
                    if (dentroJanela && direito) return setConfirmar({ tipo: 'janela', vaga: v, direito });
                    if (!direito) return setConfirmar({ tipo: 'extra', vaga: v, direito: null });
                    if (direito.kind === 'ferias') return setConfirmar({ tipo: 'ferias', vaga: v, direito });
                    if (direito.kind === 'credito') return setConfirmar({ tipo: 'credito', vaga: v, direito });
                    marcarRepo(v, direito);
                  };
                  const kind = direito?.kind;
                  return (
                    <div key={v.id} className={`px-4 py-3 flex items-center justify-between gap-3 ${minhaVagaFerias && kind === 'ferias' ? 'bg-teal-50/50' : kind === 'credito' ? 'bg-purple-50/30' : ''}`}>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800 text-sm">{fmtBR(v.data).slice(0, 5)}</div>
                        <div className="text-xs text-gray-500">
                          {rotuloTurma(v.turmaId)}
                          {minhaVagaFerias && <span className="ml-1 text-teal-600">· vaga das suas férias</span>}
                        </div>
                        {jaTenho && <div className="text-xs text-red-500 mt-0.5">Você já tem reposição nesse horário</div>}
                        {!jaTenho && esperandoSemAntec && (
                          <div className="text-xs text-orange-500 mt-0.5">
                            Liberada {janela}h antes da {vocab.aula} começar, se a vaga continuar disponível
                          </div>
                        )}
                      </div>
                      <button onClick={clique} disabled={jaTenho || ocupado}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40 shrink-0 border ${
                          kind === 'falta' ? 'text-blue-600 border-blue-300 bg-blue-50'
                            : kind === 'ferias' ? 'text-teal-700 border-teal-300 bg-teal-50'
                              : kind === 'credito' ? 'text-purple-700 border-purple-300 bg-purple-50'
                                : 'text-green-700 border-green-300 bg-green-50'}`}>
                        {kind === 'falta' ? 'Repor' : kind === 'ferias' ? 'Repor (férias)' : kind === 'credito' ? 'Repor (crédito)' : `${cap(vocab.aula)} extra`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Cartao>
        </div>

        {/* Minhas reposições */}
        <Cartao icone="🗓️" titulo="Minhas reposições"
          sub={`${minhasRepos.length} agendada${minhasRepos.length !== 1 ? 's' : ''}`}
          aberto={aberto.minhas} onToggle={() => alternar('minhas')} semPadding>
          {minhasRepos.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400 italic">Nenhuma reposição agendada.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {minhasRepos.map((r) => {
                const faixa = faixaCancelamentoRepo(r, fatia, config);
                const faltaVinc = r.faltaId ? fatia.faltas.find((f) => f.id === r.faltaId) : null;
                const ausVinc = r.ausenciaId ? fatia.ausencias.find((a) => a.id === r.ausenciaId) : null;
                return (
                  <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-800 text-sm">
                        {cap(getDiaSemanaFromDateStr(r.dataReposicao))}, {fmtBRFull(r.dataReposicao)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {rotuloTurma(r.turmaReposicaoId)}
                        {faltaVinc ? ` · Repõe falta de ${fmtBR(faltaVinc.datas[0])}` : ''}
                        {ausVinc ? ` · 🏖️ Férias de ${getMesNome(ausVinc.mesAno)}` : ''}
                      </div>
                      {faixa !== 'devolve' && (
                        <div className="text-xs text-orange-500 mt-0.5">
                          ⚠️ {faixa === 'semCredito' ? 'Cancelar agora não devolve o direito' : 'Cancelar agora devolve como falta sem antecedência'}
                        </div>
                      )}
                    </div>
                    <button onClick={() => setCancelarRepo({ repo: r, faixa })} disabled={ocupado}
                      className="text-xs text-red-500 border border-red-200 px-2.5 py-1 rounded-lg font-medium shrink-0 disabled:opacity-40">
                      Cancelar
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Cartao>

        {/* Férias */}
        {!ehExtra && config?.regras?.ferias && (
          <Cartao icone="🏖️" titulo="Férias"
            sub={fatia.ausencias.length ? `${fatia.ausencias.length} período registrado${fatia.ausencias.length > 1 ? 's' : ''}` : 'Registre uma ausência programada'}
            aberto={aberto.ferias} onToggle={() => alternar('ferias')}>
            <div className="space-y-3">
              {fatia.ausencias.map((a) => {
                const exp = ausenciaExpiry(a, config);
                const expirado = exp < td;
                const semCredito = !a.creditoReposicao;
                return (
                  <div key={a.id} className={`rounded-lg px-3 py-2 text-sm ${semCredito ? 'bg-gray-50 border border-gray-200' : expirado ? 'bg-red-50 border border-red-200' : 'bg-teal-50 border border-teal-200'}`}>
                    <div className="font-semibold text-gray-800">Férias de {getMesNome(a.mesAno)}</div>
                    <div className={`text-xs font-medium mt-0.5 ${semCredito || a.creditoUsado ? 'text-gray-400' : expirado ? 'text-red-600' : 'text-teal-700'}`}>
                      {semCredito ? '— Sem crédito (mês de recesso)'
                        : a.creditoUsado ? '✓ Crédito usado'
                          : expirado ? '⚠️ Crédito expirado'
                            : `🎫 ${a.creditoReposicao} reposição disponível — expira ${fmtBR(exp)}`}
                    </div>
                    {arr(a.datasLiberadas).length > 0 && (
                      <div className="text-xs text-teal-600 mt-1">
                        Vagas liberadas:{' '}
                        {a.datasLiberadas.map((v, i) => (
                          <span key={i}>
                            {i > 0 && ', '}
                            {v.bloqueada ? <span className="text-gray-400">🏠 {fmtBR(v.data).slice(0, 5)}</span>
                              : v.consumida ? <span className="text-gray-400 line-through">{fmtBR(v.data)}</span>
                                : <span>{fmtBR(v.data)}</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {mesesFerias.length > 0 ? (
                <>
                  <label className="block text-xs font-medium text-gray-600">Registrar período de férias</label>
                  <select value={mesFerias} onChange={(e) => setMesFerias(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="">Escolha o mês…</option>
                    {mesesFerias.map((m) => {
                      const [y, mo] = m.split('-').map(Number);
                      return <option key={m} value={m}>{MESES_PT[mo - 1]} {y}</option>;
                    })}
                  </select>
                  <button onClick={registrarFerias} disabled={!mesFerias || ocupado}
                    className="w-full py-2 bg-teal-500 text-white rounded-lg text-sm font-semibold disabled:opacity-40">
                    {ocupado ? 'Enviando…' : 'Confirmar férias'}
                  </button>
                </>
              ) : (
                <p className="text-xs text-gray-400 italic">
                  {fatia.ausencias.length ? 'Você já usou seus períodos de férias deste ano.' : 'Nenhum mês disponível para férias.'}
                </p>
              )}
            </div>
          </Cartao>
        )}

        {sucesso && <div className="bg-green-50 text-green-700 rounded-xl px-4 py-3 text-sm font-medium">{sucesso}</div>}

        <div className="text-center text-xs text-gray-400 py-4">Qualquer coisa, fale com {nomeEscola} 💬</div>
      </div>

      {/* ---- Modais ---- */}
      {verNotif && (
        <AvisosModal fatia={fatia} vocab={vocab} notificar={notificar}
          temPendentes={faltasPendentes.length > 0}
          onSalvar={(lista) => executar({ type: 'SET_ALUNO_WATCHLIST', watchlist: lista })}
          onClose={() => setVerNotif(false)} />
      )}

      {cancelarFalta && (
        <ConfirmModal
          title="Cancelar falta?" danger confirmLabel="Cancelar falta"
          message={`Cancelar a falta de ${fmtBRFull(cancelarFalta.datas[0])}? A vaga volta a ficar disponível.`}
          onConfirm={async () => { const f = cancelarFalta; setCancelarFalta(null); await executar({ type: 'CANCEL_FALTA', id: f.id }); }}
          onCancel={() => setCancelarFalta(null)}
        />
      )}

      {cancelarRepo && (
        <ConfirmModal
          title="Cancelar reposição?" danger confirmLabel="Cancelar reposição"
          message={
            cancelarRepo.faixa === 'semCredito'
              ? `Falta menos de ${janela}h para essa ${vocab.aula}. Você pode cancelar, mas o direito não volta. Cancelar mesmo assim?`
              : cancelarRepo.faixa === 'semAntecedencia'
                ? `Falta menos de ${horasPrazo}h. Você pode cancelar, mas a falta volta como "sem antecedência" — só dá para remarcar quando faltar menos de ${janela}h para a ${vocab.aula}. Cancelar?`
                : cancelarRepo.repo.ausenciaId
                  ? `Cancelar a reposição de ${fmtBRFull(cancelarRepo.repo.dataReposicao)}? Seu crédito de férias volta a ficar disponível.`
                  : `Cancelar a reposição de ${fmtBRFull(cancelarRepo.repo.dataReposicao)}? A falta volta para pendente.`
          }
          onConfirm={confirmarCancelRepo}
          onCancel={() => setCancelarRepo(null)}
        />
      )}

      {confirmar && (
        <ConfirmModal
          title={
            confirmar.tipo === 'janela' ? `⚠️ ${cap(vocab.aula)} quase começando`
              : confirmar.tipo === 'ferias' ? 'Usar crédito de férias?'
                : confirmar.tipo === 'credito' ? 'Usar crédito extra?'
                  : `Confirmar ${vocab.aula} extra?`
          }
          confirmLabel={confirmar.tipo === 'janela' ? 'Marcar mesmo assim' : 'Confirmar'}
          message={mensagemConfirmacao(confirmar, fatia, config, vocab, janela)}
          onConfirm={() => marcarRepo(confirmar.vaga, confirmar.direito)}
          onCancel={() => setConfirmar(null)}
        />
      )}
    </div>
  );
}

function mensagemConfirmacao({ tipo, vaga, direito }, fatia, config, vocab, janela) {
  const onde = `${fmtBRFull(vaga.data)} (${turmaShortLabel(fatia.turmas.find((t) => t.id === vaga.turmaId))})`;
  if (tipo === 'janela') {
    const oQue = direito?.kind === 'ferias' ? 'o crédito de férias'
      : direito?.kind === 'credito' ? 'o crédito extra' : 'a reposição desta falta';
    return `Essa ${vocab.aula} (${onde}) começa em menos de ${janela}h. Se marcar agora e depois precisar cancelar, você NÃO recupera ${oQue}. Tem certeza?`;
  }
  if (tipo === 'ferias') {
    const aus = fatia.ausencias.find((a) => a.id === direito.id);
    return `Usar seu crédito de reposição de férias (${aus ? getMesNome(aus.mesAno) : ''}) para repor em ${onde}?`;
  }
  if (tipo === 'credito') {
    const cr = fatia.creditos.find((c) => c.id === direito.id);
    return `Usar seu crédito de reposição extra${cr ? ` (expira em ${fmtBRFull(cr.dataExpiracao)})` : ''} para repor em ${onde}?`;
  }
  return `Você não tem direito de reposição pendente, então essa será uma ${vocab.aula} extra em ${onde}. Pode ter custo adicional — confirme com a escola.`;
}

function horaDe(turmaId, data, fatia) {
  const dt = getClassDatetime(turmaId, data, fatia.turmas);
  if (!dt) return '?';
  const m = dt.getMinutes();
  return `${String(dt.getHours()).padStart(2, '0')}h${m ? String(m).padStart(2, '0') : ''}`;
}

// ---- Peças de UI ----
function Cartao({ icone, titulo, sub, aberto, onToggle, semPadding, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center justify-between text-left gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-xl shrink-0">{icone}</div>
          <div className="min-w-0">
            <div className="font-semibold text-gray-800 text-sm">{titulo}</div>
            <div className="text-xs text-gray-500 truncate">{sub}</div>
          </div>
        </div>
        <div className="text-gray-400 text-sm shrink-0">{aberto ? '‹' : '›'}</div>
      </button>
      {aberto && <div className={`border-t border-gray-100 ${semPadding ? '' : 'px-4 py-3'}`}>{children}</div>}
    </div>
  );
}

function Chip({ children, sel, tom, desabilitado, onClick }) {
  if (desabilitado) {
    return (
      <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-not-allowed opacity-60 ${tom === 'teal' ? 'border-teal-100 bg-teal-50/50 text-teal-700' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
        <input type="checkbox" checked={false} disabled className="w-4 h-4 shrink-0" />
        <span className="text-sm">{children}</span>
      </label>
    );
  }
  const cor = tom === 'orange'
    ? (sel ? 'border-orange-400 bg-orange-50' : 'border-orange-200 bg-orange-50/40 hover:bg-orange-50')
    : (sel ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:bg-gray-50');
  return (
    <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${cor}`}>
      <input type="checkbox" checked={!!sel} onChange={onClick} className={`w-4 h-4 shrink-0 ${tom === 'orange' ? 'accent-orange-500' : 'accent-amber-500'}`} />
      <span className="text-sm text-gray-800">{children}</span>
    </label>
  );
}

function AvisosModal({ fatia, vocab, notificar, temPendentes, onSalvar, onClose }) {
  const [lista, setLista] = useState(fatia.watchlist);
  const permissao = notificar.permissao;

  const alternar = async (tid) => {
    let nova;
    if (lista.includes(tid)) nova = lista.filter((x) => x !== tid);
    else {
      const ok = await notificar.pedirPermissao();
      if (!ok) return;
      nova = [...lista, tid];
    }
    setLista(nova);
    onSalvar(nova);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-w-md p-6 pb-8 shadow-xl overflow-y-auto max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900">🔔 Avisos de vaga</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Fechar">✕</button>
        </div>
        <p className="text-sm text-gray-500 mb-1">
          Avisa quando abrir vaga numa {vocab.turma} que você escolher — útil se você só pode repor em dias específicos.
        </p>
        <p className="text-xs text-gray-400 mb-4">
          O app precisa estar aberto (pode ficar em segundo plano). O aviso para sozinho quando você não tiver mais faltas pendentes.
        </p>
        {!temPendentes && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 mb-4">
            Você não tem faltas pendentes agora — os avisos só disparam quando houver.
          </div>
        )}
        {permissao === 'denied' && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700 mb-4">
            Avisos bloqueados no seu navegador. Libere nas configurações do site para ativar.
          </div>
        )}
        <div className="space-y-2">
          {fatia.turmas.filter((t) => t.id !== TURMA_EXTRA_ID && arr(t.encontros).length).map((t) => {
            const ativo = lista.includes(t.id);
            return (
              <button key={t.id} onClick={() => alternar(t.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors ${ativo ? 'bg-amber-50 border-amber-300 text-amber-800 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <span>{getTurmaLabel(fatia.turmas, t.id)}</span>
                <span>{ativo ? '🔔 Ativo' : '🔕'}</span>
              </button>
            );
          })}
        </div>
        {lista.length > 0 && (
          <button onClick={() => { setLista([]); onSalvar([]); }}
            className="mt-4 w-full text-xs text-gray-400 hover:text-red-500 transition-colors">Desativar todos</button>
        )}
      </div>
    </div>
  );
}

// Aviso de vaga nova. No original o navegador do aluno tinha o banco inteiro e
// comparava state.vagas; aqui compara as vagas da própria fatia, que é o que
// ele pode ver — mesmo efeito, sem expor a escola.
function useNotificacoesDeVaga(fatia, temPendentes) {
  const anterior = useRef(null);
  const [permissao, setPermissao] = useState(
    () => (typeof Notification !== 'undefined' ? Notification.permission : 'denied'),
  );

  useEffect(() => {
    const antes = anterior.current;
    anterior.current = fatia.vagas;
    if (!antes || !temPendentes) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const conhecidas = new Set(antes.map((v) => v.id));
    fatia.vagas
      .filter((v) => !conhecidas.has(v.id) && arr(fatia.watchlist).includes(v.turmaId))
      .forEach((v) => {
        const rotulo = getTurmaLabel(fatia.turmas, v.turmaId);
        try {
          new Notification(`🎉 Vaga aberta — ${rotulo}`, { body: fmtBRFull(v.data), tag: v.id });
        } catch { /* alguns navegadores exigem service worker */ }
      });
  }, [fatia.vagas, fatia.watchlist, fatia.turmas, temPendentes]);

  const pedirPermissao = async () => {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    const p = await Notification.requestPermission();
    setPermissao(p);
    return p === 'granted';
  };

  return { permissao, pedirPermissao };
}
