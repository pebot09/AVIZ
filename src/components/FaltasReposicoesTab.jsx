import { useEffect, useMemo, useState } from 'react';
import {
  arr, sortTurmas, EXTENSO, ABREV, fmtBR, fmtBRFull, todayStr, dateToStr, parseDate,
  turmaShortLabel, getTurmaLabel, getFaltaEarliest, getFaltaExpiry, getMesNome, getLastDayOfMonth,
} from '../domain/helpers.js';
import {
  getNextOccurrences, getClassDatesInRange, getClassDatetime,
  getDiaSemanaFromDateStr, feriadoNome, recessoNome, isRecesso,
} from '../domain/calendario.js';
import {
  reposicaoRights, pickReposicaoRight, rightToActionFields, calcOccupancy, fmtDatesText,
} from '../domain/reposicao.js';
import { cap } from '../domain/vocab.js';
import ConfirmModal from './ConfirmModal.jsx';

// Aba Faltas & Reposições — porte do SectionFaltasReposicoes (acordeão de
// grupos). Nesta fatia, Faltas ▸ Registrar está funcional; os demais entram nas
// próximas sub-fatias.
export default function FaltasReposicoesTab({ state, dispatch, vocab, config }) {
  const [openGroup, setOpenGroup] = useState('faltas');
  const [subTab, setSubTab] = useState({});
  const getSub = (g) => subTab[g] ?? 0;

  const groups = [
    { key: 'faltas', label: 'Faltas', color: 'amber', tabs: ['Registrar', 'Cancelar'],
      content: [<TabRegistrarFalta state={state} dispatch={dispatch} vocab={vocab} config={config} />, <TabCancelarFalta state={state} dispatch={dispatch} vocab={vocab} />] },
    { key: 'reposicoes', label: 'Reposições', color: 'blue', tabs: ['Registrar', 'Cancelar'],
      content: [<TabRegistrarReposicao state={state} dispatch={dispatch} vocab={vocab} config={config} />, <TabCancelarReposicao state={state} dispatch={dispatch} vocab={vocab} />] },
    { key: 'ferias', label: 'Férias', color: 'green', tabs: ['Ausência Programada'],
      content: [config?.regras?.ferias ? <TabAusenciaProgramada state={state} dispatch={dispatch} vocab={vocab} config={config} /> : <NaoOferece texto={`Sua escola não oferece marcação de férias.`} />] },
    { key: 'credito', label: 'Crédito Extra', color: 'purple', tabs: ['Dar Crédito'],
      content: [<TabCreditoExtra state={state} dispatch={dispatch} vocab={vocab} />] },
    { key: 'cancelarAula', label: `Cancelar ${cap(vocab.aula)}`, color: 'red', tabs: ['Cancelar'],
      content: [<TabCancelarAula state={state} dispatch={dispatch} vocab={vocab} config={config} />] },
  ];

  const colorMap = {
    amber: { header: 'bg-amber-50 border-amber-200 text-amber-800', tab: 'border-amber-500 text-amber-700 bg-amber-50' },
    blue: { header: 'bg-blue-50 border-blue-200 text-blue-800', tab: 'border-blue-600 text-blue-700 bg-blue-50' },
    green: { header: 'bg-green-50 border-green-200 text-green-800', tab: 'border-green-600 text-green-700 bg-green-50' },
    purple: { header: 'bg-purple-50 border-purple-200 text-purple-800', tab: 'border-purple-600 text-purple-700 bg-purple-50' },
    red: { header: 'bg-red-50 border-red-200 text-red-800', tab: 'border-red-600 text-red-700 bg-red-50' },
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Faltas &amp; Reposições</h2>
      <div className="space-y-3">
        {groups.map((group) => {
          const isOpen = openGroup === group.key;
          const c = colorMap[group.color];
          const cur = getSub(group.key);
          return (
            <div key={group.key} className={`rounded-xl border overflow-hidden shadow-sm ${isOpen ? c.header.split(' ').slice(0, 2).join(' ') : 'bg-white border-gray-200'}`}>
              <button onClick={() => setOpenGroup(isOpen ? null : group.key)} className={`w-full flex items-center justify-between px-4 py-3 font-semibold text-sm transition-colors ${isOpen ? c.header : 'text-gray-700 hover:bg-gray-50'}`}>
                <span>{group.label}</span>
                <span className="text-base">{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (
                <div className="bg-white">
                  {group.tabs.length > 1 && (
                    <div className="flex border-b border-gray-200">
                      {group.tabs.map((t, i) => (
                        <button key={i} onClick={() => setSubTab((p) => ({ ...p, [group.key]: i }))} className={`px-4 py-2 text-sm font-medium transition-colors ${cur === i ? `border-b-2 ${c.tab}` : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>{t}</button>
                      ))}
                    </div>
                  )}
                  <div className="p-4">{group.content[cur]}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmBreve() {
  return <p className="text-gray-400 text-sm italic py-4 text-center">Em construção — próxima sub-fatia.</p>;
}

function NaoOferece({ texto }) {
  return <p className="text-gray-400 text-sm italic py-4 text-center">{texto}</p>;
}

function TabRegistrarFalta({ state, dispatch, vocab, config }) {
  const [turmaId, setTurmaId] = useState('');
  const [alunoNome, setAlunoNome] = useState('');
  const [selectedDates, setSelectedDates] = useState([]);
  const [success, setSuccess] = useState('');
  const [tiposModal, setTiposModal] = useState(null);
  const [retroModal, setRetroModal] = useState(false);
  const [retroDate, setRetroDate] = useState('');

  const antecedencia = Number(config?.regras?.antecedenciaHoras) || 0;
  const permiteSemAntec = !!config?.regras?.semAntecedencia && antecedencia > 0;

  const sorted = useMemo(() => sortTurmas(state.turmas), [state.turmas]);
  const turma = state.turmas.find((t) => t.id === turmaId);
  const occurrences = useMemo(() => (!turma ? [] : getNextOccurrences(turma, 8)), [turma]);
  const pastOccurrences = useMemo(() => {
    if (!turma) return [];
    const tresMeses = new Date(); tresMeses.setMonth(tresMeses.getMonth() - 3);
    const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
    return getClassDatesInRange(turma, dateToStr(tresMeses), dateToStr(ontem)).reverse();
  }, [turma]);

  const toggleDate = (d) => setSelectedDates((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const doSubmit = (datasComTipo) => {
    dispatch({ type: 'ADD_FALTA', alunoNome, turmaId, datasComTipo });
    setSuccess(`Falta de ${alunoNome} registrada para ${datasComTipo.length} data(s).`);
    setAlunoNome(''); setSelectedDates([]); setTiposModal(null);
    setTimeout(() => setSuccess(''), 4000);
  };

  const handleSubmit = () => {
    if (!turmaId || !alunoNome || !selectedDates.length) return;
    const td = todayStr();
    if (!permiteSemAntec) { doSubmit(selectedDates.map((d) => ({ data: d, semAntecedencia: false }))); return; }
    const precisaEscolher = selectedDates.filter((d) => {
      if (d === td) return true;
      const dt = getClassDatetime(turmaId, d, state.turmas);
      if (!dt) return false;
      const horas = (dt - Date.now()) / 3600000;
      return horas >= 0 && horas < antecedencia;
    });
    if (precisaEscolher.length > 0) { setTiposModal(precisaEscolher.map((d) => ({ data: d, semAntecedencia: true }))); return; }
    doSubmit(selectedDates.map((d) => ({ data: d, semAntecedencia: false })));
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-700">Registrar Falta</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{cap(vocab.turma)}</label>
        <select value={turmaId} onChange={(e) => { setTurmaId(e.target.value); setAlunoNome(''); setSelectedDates([]); }} className="w-full border border-gray-300 rounded-lg px-3 py-2">
          <option value="">— Selecione a {vocab.turma} —</option>
          {sorted.map((t) => <option key={t.id} value={t.id}>{getTurmaLabel(state.turmas, t.id)}{t.observacao ? ` (${t.observacao})` : ''}</option>)}
        </select>
      </div>

      {turma && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{cap(vocab.aluno)}</label>
          <select value={alunoNome} onChange={(e) => setAlunoNome(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
            <option value="">— Selecione o {vocab.aluno} —</option>
            {[...turma.alunos].sort((a, b) => a.localeCompare(b, 'pt')).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {turma.alunos.length === 0 && <p className="text-amber-600 text-sm mt-1">Esta {vocab.turma} não tem {vocab.alunos} cadastrados.</p>}
        </div>
      )}

      {turma && alunoNome && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Datas da falta (próximas)</label>
            {pastOccurrences.length > 0 && (
              <button onClick={() => { setRetroModal(true); setRetroDate(''); }} className="text-xs px-2.5 py-1 rounded-lg border border-orange-300 bg-orange-50 text-orange-700 font-medium hover:bg-orange-100 transition-colors">⏪ Retroativas</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {occurrences.map((d) => {
              const fer = feriadoNome(d, config);
              const rec = !fer ? recessoNome(d, config) : null;
              const jaReg = !fer && !rec && state.faltas.some((f) => f.alunoNome === alunoNome && f.turmaId === turmaId && f.datas.includes(d) && (f.status === 'pendente' || f.status === 'marcada'));
              const disabled = !!fer || !!rec || jaReg;
              return (
                <label key={d} className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors ${disabled ? 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60' : selectedDates.includes(d) ? 'border-blue-500 bg-blue-50 cursor-pointer' : 'border-gray-200 hover:bg-gray-50 cursor-pointer'}`}>
                  <input type="checkbox" checked={!disabled && selectedDates.includes(d)} disabled={disabled} onChange={() => { if (!disabled) toggleDate(d); }} className="rounded" />
                  <span className="text-sm">
                    {fmtBRFull(d)} <span className="text-gray-400">({ABREV[getDiaSemanaFromDateStr(d)]})</span>
                    {fer && <span className="ml-1 text-xs text-purple-500 font-medium">🎌 {fer}</span>}
                    {rec && <span className="ml-1 text-xs text-amber-600 font-medium">🏠 {rec}</span>}
                    {!fer && !rec && jaReg && <span className="ml-1 text-xs text-orange-500 font-medium">já registrado</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {retroModal && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="font-semibold text-amber-800 text-sm">⏪ Falta retroativa</div>
          <div className="text-xs text-amber-700">Data da aula passada (até 3 meses):</div>
          <select value={retroDate} onChange={(e) => setRetroDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">— Selecione a data —</option>
            {pastOccurrences.filter((d) => {
              const jaReg = state.faltas.some((f) => f.alunoNome === alunoNome && f.turmaId === turmaId && f.datas.includes(d) && (f.status === 'pendente' || f.status === 'marcada'));
              return !recessoNome(d, config) && !feriadoNome(d, config) && !jaReg;
            }).map((d) => <option key={d} value={d}>{fmtBRFull(d)} ({ABREV[getDiaSemanaFromDateStr(d)]})</option>)}
          </select>
          <div className="flex gap-2">
            <button disabled={!retroDate} onClick={() => { setRetroModal(false); doSubmit([{ data: retroDate, semAntecedencia: false }]); }} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-40">Comum</button>
            {permiteSemAntec && (
              <button disabled={!retroDate} onClick={() => { setRetroModal(false); doSubmit([{ data: retroDate, semAntecedencia: true }]); }} className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold disabled:opacity-40">Sem antecedência</button>
            )}
          </div>
          <button onClick={() => setRetroModal(false)} className="w-full py-2 border border-gray-300 rounded-lg text-sm text-gray-600">Cancelar</button>
        </div>
      )}

      {tiposModal && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
          <div className="font-semibold text-orange-800 text-sm">⚠️ Falta com menos de {antecedencia}h de antecedência</div>
          <div className="text-xs text-orange-700">Classifique cada data:</div>
          {tiposModal.map((item, i) => (
            <div key={item.data} className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-gray-800">{fmtBRFull(item.data)}</span>
              <div className="flex gap-2">
                <button onClick={() => setTiposModal((prev) => prev.map((x, j) => (j === i ? { ...x, semAntecedencia: false } : x)))} className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${!item.semAntecedencia ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>Comum</button>
                <button onClick={() => setTiposModal((prev) => prev.map((x, j) => (j === i ? { ...x, semAntecedencia: true } : x)))} className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${item.semAntecedencia ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-300'}`}>Sem antecedência</button>
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setTiposModal(null)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600">Cancelar</button>
            <button onClick={() => { const dct = selectedDates.map((d) => { const f = tiposModal.find((x) => x.data === d); return { data: d, semAntecedencia: f ? f.semAntecedencia : false }; }); doSubmit(dct); }} className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold">Confirmar</button>
          </div>
        </div>
      )}

      {success && <div className="bg-green-50 text-green-700 rounded-lg px-4 py-3 text-sm font-medium">{success}</div>}

      <button onClick={handleSubmit} disabled={!turmaId || !alunoNome || !selectedDates.length} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">Registrar Falta</button>
    </div>
  );
}

function TabRegistrarReposicao({ state, dispatch, vocab, config }) {
  const [turmaOrigemId, setTurmaOrigemId] = useState('');
  const [alunoNome, setAlunoNome] = useState('');
  const [vagaSel, setVagaSel] = useState('');
  const [extraData, setExtraData] = useState('');
  const [extraTurma, setExtraTurma] = useState('');
  const [tipoManual, setTipoManual] = useState('reposicao');
  const [success, setSuccess] = useState('');

  const td = todayStr();
  const janela = Number(config?.regras?.semAntecedenciaJanela) || 0;
  const sorted = useMemo(() => sortTurmas(state.turmas), [state.turmas]);
  const turmaOrigem = state.turmas.find((t) => t.id === turmaOrigemId);

  const vagasFuturas = useMemo(() => {
    const seen = new Set();
    return [...state.vagas]
      // Não pode repor na própria turma de origem (nenhuma data).
      .filter((v) => v.data >= td && v.turmaId !== turmaOrigemId)
      .sort((a, b) => {
        if (a.data !== b.data) return a.data.localeCompare(b.data);
        const ta = getClassDatetime(a.turmaId, a.data, state.turmas);
        const tb = getClassDatetime(b.turmaId, b.data, state.turmas);
        return (ta ? ta.getTime() : 0) - (tb ? tb.getTime() : 0);
      })
      .filter((v) => { const k = `${v.data}|${v.turmaId}`; if (seen.has(k)) return false; seen.add(k); return true; });
  }, [state.vagas, state.turmas, td, turmaOrigemId]);

  const isManual = vagaSel === 'livre';
  const vagaObj = !isManual && vagaSel ? state.vagas.find((v) => v.id === vagaSel) : null;
  const dataRepo = isManual ? extraData : (vagaObj?.data || '');
  const turmaRepoId = isManual ? extraTurma : (vagaObj?.turmaId || '');
  const turmaRepo = state.turmas.find((t) => t.id === turmaRepoId);

  const rights = useMemo(() => (alunoNome && turmaOrigemId ? reposicaoRights(state, alunoNome, turmaOrigemId, td, config) : []), [state, alunoNome, turmaOrigemId, td, config]);
  const dentroJanela = useMemo(() => {
    const dt = getClassDatetime(turmaRepoId, dataRepo, state.turmas);
    if (!dt || janela <= 0) return false;
    const h = (dt - Date.now()) / 3600000;
    return h >= 0 && h <= janela;
  }, [turmaRepoId, dataRepo, state.turmas, janela]);
  const picked = useMemo(() => pickReposicaoRight(rights, dentroJanela), [rights, dentroJanela]);
  const hasPending = rights.some((r) => r.kind === 'falta' && !r.semAntecedencia);

  const faltaInfo = useMemo(() => {
    if (!alunoNome) return null;
    const pend = state.faltas.filter((f) => f.alunoNome === alunoNome && f.status === 'pendente').sort((a, b) => getFaltaEarliest(a).localeCompare(getFaltaEarliest(b)));
    if (!pend.length) return null;
    const o = pend[0];
    return { turmaId: o.turmaId, datas: o.datas, expiry: getFaltaExpiry(o, config) };
  }, [alunoNome, state.faltas, config]);

  const occupancy = useMemo(() => (turmaRepoId && dataRepo ? calcOccupancy(turmaRepoId, dataRepo, state) : null), [turmaRepoId, dataRepo, state]);
  const jaTemRepo = !!(alunoNome && dataRepo && turmaRepoId && state.reposicoes.some((r) => r.alunoNome === alunoNome && r.dataReposicao === dataRepo && r.turmaReposicaoId === turmaRepoId && !r.realizada));
  const canSubmit = turmaOrigemId && alunoNome && vagaSel && dataRepo && turmaRepoId && !jaTemRepo;

  const pickedLabel = (r) => {
    if (!r) return null;
    if (r.kind === 'falta') return `falta pendente (vence ${fmtBRFull(r.expiry)})`;
    if (r.kind === 'ferias') return `crédito de férias (vence ${fmtBRFull(r.expiry)})`;
    return `crédito extra (vence ${fmtBRFull(r.expiry)})`;
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    const forcarAulaExtra = !hasPending && tipoManual === 'aula_extra';
    const fields = forcarAulaExtra ? { tipo: 'aula_extra' } : picked ? rightToActionFields(picked) : { tipo: 'reposicao' };
    dispatch({ type: 'ADD_REPOSICAO', alunoNome, turmaOrigemId, dataReposicao: dataRepo, turmaReposicaoId: turmaRepoId, semVagaOficial: isManual, vagaSelId: vagaObj?.id || null, ...fields });
    setSuccess(`${forcarAulaExtra ? 'Aula extra' : 'Reposição'} de ${alunoNome} agendada para ${fmtBRFull(dataRepo)}.`);
    setAlunoNome(''); setVagaSel(''); setExtraData(''); setExtraTurma(''); setTipoManual('reposicao');
    setTimeout(() => setSuccess(''), 4000);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-700">Registrar Reposição</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{cap(vocab.turma)} de origem</label>
        <select value={turmaOrigemId} onChange={(e) => { setTurmaOrigemId(e.target.value); setAlunoNome(''); setVagaSel(''); }} className="w-full border border-gray-300 rounded-lg px-3 py-2">
          <option value="">— Selecione a {vocab.turma} —</option>
          {sorted.map((t) => <option key={t.id} value={t.id}>{getTurmaLabel(state.turmas, t.id)}</option>)}
        </select>
      </div>

      {turmaOrigem && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{cap(vocab.aluno)}</label>
          <select value={alunoNome} onChange={(e) => { setAlunoNome(e.target.value); setVagaSel(''); setTipoManual('reposicao'); }} className="w-full border border-gray-300 rounded-lg px-3 py-2">
            <option value="">— Selecione o {vocab.aluno} —</option>
            {[...turmaOrigem.alunos].sort((a, b) => a.localeCompare(b, 'pt')).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}

      {alunoNome && faltaInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
          <div className="font-medium text-blue-800">Falta mais antiga a consumir:</div>
          <div className="text-blue-700 mt-0.5">{getTurmaLabel(state.turmas, faltaInfo.turmaId)} — <strong>{fmtDatesText(faltaInfo.datas)}</strong></div>
          <div className="text-blue-600 mt-0.5">Expira em: {fmtBRFull(faltaInfo.expiry)}</div>
        </div>
      )}

      {alunoNome && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vaga</label>
          <select value={vagaSel} onChange={(e) => { setVagaSel(e.target.value); setExtraData(''); setExtraTurma(''); setTipoManual('reposicao'); }} className="w-full border border-gray-300 rounded-lg px-3 py-2">
            <option value="">— Selecione a vaga —</option>
            {vagasFuturas.map((v) => {
              const t = state.turmas.find((x) => x.id === v.turmaId);
              return <option key={v.id} value={v.id}>{fmtBRFull(v.data)} ({ABREV[getDiaSemanaFromDateStr(v.data)]}) — {turmaShortLabel(t)}{v.vagaExtra ? ' ✦ vaga extra' : ''}</option>;
            })}
            <option value="livre">✦ Escolher data / {vocab.turma}</option>
          </select>
          {vagasFuturas.length === 0 && !isManual && <p className="text-gray-400 text-sm mt-1">Nenhuma vaga aberta no momento.</p>}
        </div>
      )}

      {isManual && (
        <div className="space-y-3 pl-3 border-l-2 border-blue-300">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
            <input type="date" value={extraData} min={td} onChange={(e) => setExtraData(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{cap(vocab.turma)}</label>
            <select value={extraTurma} onChange={(e) => setExtraTurma(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="">— Selecione a {vocab.turma} —</option>
              {sorted.filter((t) => t.id !== turmaOrigemId).map((t) => <option key={t.id} value={t.id}>{getTurmaLabel(state.turmas, t.id)}</option>)}
            </select>
          </div>
        </div>
      )}

      {!hasPending && vagaSel && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
          <div className="flex gap-3">
            <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${tipoManual === 'reposicao' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
              <input type="radio" name="tipoManual" value="reposicao" checked={tipoManual === 'reposicao'} onChange={() => setTipoManual('reposicao')} />
              <span className="text-sm font-medium">{picked ? 'Reposição (usa crédito)' : 'Reposição sem falta vinculada'}</span>
            </label>
            <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${tipoManual === 'aula_extra' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
              <input type="radio" name="tipoManual" value="aula_extra" checked={tipoManual === 'aula_extra'} onChange={() => setTipoManual('aula_extra')} />
              <span className="text-sm font-medium">Aula extra</span>
            </label>
          </div>
        </div>
      )}

      {vagaSel && picked && !(!hasPending && tipoManual === 'aula_extra') && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-700">Vai consumir: <strong>{pickedLabel(picked)}</strong></div>
      )}

      {occupancy !== null && turmaRepo && (
        <div className={`rounded-lg px-3 py-2 text-sm font-medium border ${occupancy + 1 > turmaRepo.capacidade ? 'bg-red-50 text-red-700 border-red-200' : occupancy + 1 === turmaRepo.capacidade ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
          {getTurmaLabel(state.turmas, turmaRepoId)} em {fmtBRFull(dataRepo)}: {occupancy + 1}/{turmaRepo.capacidade} {vocab.alunos} esperados{occupancy + 1 > turmaRepo.capacidade && ' ⚠️ Acima da capacidade!'}
        </div>
      )}

      {jaTemRepo && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 font-medium">{alunoNome} já tem reposição nesse horário.</div>}
      {success && <div className="bg-green-50 text-green-700 rounded-lg px-4 py-3 text-sm font-medium">{success}</div>}

      <button onClick={handleSubmit} disabled={!canSubmit} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">Confirmar Reposição</button>
    </div>
  );
}

function TabCancelarFalta({ state, dispatch, vocab }) {
  const [turmaId, setTurmaId] = useState('');
  const [alunoNome, setAlunoNome] = useState('');
  const [faltaId, setFaltaId] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [success, setSuccess] = useState('');
  const td = todayStr();

  const faltasFuturas = useMemo(() => state.faltas.filter((f) => f.status === 'pendente' && f.datas[0] >= td), [state.faltas, td]);
  const turmas = useMemo(() => { const ids = new Set(faltasFuturas.map((f) => f.turmaId)); return sortTurmas(state.turmas.filter((t) => ids.has(t.id))); }, [faltasFuturas, state.turmas]);
  const alunos = useMemo(() => (!turmaId ? [] : [...new Set(faltasFuturas.filter((f) => f.turmaId === turmaId).map((f) => f.alunoNome))].sort((a, b) => a.localeCompare(b, 'pt'))), [turmaId, faltasFuturas]);
  const faltas = useMemo(() => (!turmaId || !alunoNome ? [] : faltasFuturas.filter((f) => f.turmaId === turmaId && f.alunoNome === alunoNome).sort((a, b) => a.datas[0].localeCompare(b.datas[0]))), [turmaId, alunoNome, faltasFuturas]);
  const falta = faltas.find((f) => f.id === faltaId);
  const repoVinc = falta ? state.reposicoes.find((r) => r.vagaConsumedFaltaId === falta.id) : null;
  const outraVaga = repoVinc ? state.vagas.find((v) => v.turmaId === repoVinc.turmaReposicaoId && v.data === repoVinc.dataReposicao && v.faltaId !== falta.id) : null;

  const handleCancel = () => {
    dispatch({ type: 'CANCEL_FALTA', id: faltaId });
    setSuccess(`Falta de ${alunoNome} em ${fmtBRFull(falta.datas[0])} cancelada.`);
    setTurmaId(''); setAlunoNome(''); setFaltaId(''); setConfirm(false);
    setTimeout(() => setSuccess(''), 4000);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-700">Cancelar Falta</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{cap(vocab.turma)}</label>
        <select value={turmaId} onChange={(e) => { setTurmaId(e.target.value); setAlunoNome(''); setFaltaId(''); }} className="w-full border border-gray-300 rounded-lg px-3 py-2">
          <option value="">— Selecione —</option>
          {turmas.map((t) => <option key={t.id} value={t.id}>{getTurmaLabel(state.turmas, t.id)}</option>)}
        </select>
      </div>
      {turmaId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{cap(vocab.aluno)}</label>
          <select value={alunoNome} onChange={(e) => { setAlunoNome(e.target.value); setFaltaId(''); }} className="w-full border border-gray-300 rounded-lg px-3 py-2">
            <option value="">— Selecione —</option>
            {alunos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      )}
      {alunoNome && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Falta</label>
          <select value={faltaId} onChange={(e) => setFaltaId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
            <option value="">— Selecione —</option>
            {faltas.map((f) => <option key={f.id} value={f.id}>{fmtBRFull(f.datas[0])}</option>)}
          </select>
        </div>
      )}
      {falta && (
        <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
          <div><span className="font-medium">{cap(vocab.aluno)}:</span> {falta.alunoNome}</div>
          <div><span className="font-medium">Data:</span> {fmtBRFull(falta.datas[0])}</div>
          <div><span className="font-medium">{cap(vocab.turma)}:</span> {getTurmaLabel(state.turmas, falta.turmaId)}</div>
          {repoVinc && (
            <div className={`mt-1 text-xs px-2 py-1 rounded ${outraVaga ? 'bg-amber-50 text-amber-700' : 'bg-orange-50 text-orange-700'}`}>
              {outraVaga ? `A reposição de ${repoVinc.alunoNome} em ${fmtBRFull(repoVinc.dataReposicao)} será vinculada a outra vaga.` : `A reposição de ${repoVinc.alunoNome} em ${fmtBRFull(repoVinc.dataReposicao)} ficará sem vaga vinculada.`}
            </div>
          )}
        </div>
      )}
      {success && <div className="bg-green-50 text-green-700 rounded-lg px-4 py-3 text-sm font-medium">{success}</div>}
      <button onClick={() => setConfirm(true)} disabled={!faltaId} className="w-full py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">Cancelar Falta</button>
      {confirm && falta && <ConfirmModal title="Cancelar falta?" danger message={`Cancelar a falta de ${falta.alunoNome} em ${fmtBRFull(falta.datas[0])}?`} onConfirm={handleCancel} onCancel={() => setConfirm(false)} confirmLabel="Cancelar falta" />}
    </div>
  );
}

function TabCancelarReposicao({ state, dispatch, vocab }) {
  const [selectedId, setSelectedId] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [success, setSuccess] = useState('');
  const td = todayStr();

  const futuras = useMemo(() => state.reposicoes.filter((r) => !r.realizada && r.dataReposicao >= td).sort((a, b) => {
    if (a.dataReposicao !== b.dataReposicao) return a.dataReposicao.localeCompare(b.dataReposicao);
    const ta = getClassDatetime(a.turmaReposicaoId, a.dataReposicao, state.turmas);
    const tb = getClassDatetime(b.turmaReposicaoId, b.dataReposicao, state.turmas);
    return (ta ? ta.getTime() : 0) - (tb ? tb.getTime() : 0);
  }), [state.reposicoes, state.turmas, td]);
  const repo = futuras.find((r) => r.id === selectedId);

  const handleCancel = () => {
    dispatch({ type: 'CANCEL_REPOSICAO', id: selectedId });
    setSuccess(`Reposição de ${repo.alunoNome} em ${fmtBRFull(repo.dataReposicao)} cancelada.`);
    setSelectedId(''); setConfirm(false);
    setTimeout(() => setSuccess(''), 4000);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-700">Cancelar Reposição</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Reposição agendada</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
          <option value="">— Selecione —</option>
          {futuras.map((r) => <option key={r.id} value={r.id}>{r.alunoNome} — {fmtBRFull(r.dataReposicao)} ({getTurmaLabel(state.turmas, r.turmaReposicaoId)}) {r.tipo === 'aula_extra' ? '· Aula extra' : ''}</option>)}
        </select>
        {futuras.length === 0 && <p className="text-gray-400 text-sm mt-1">Nenhuma reposição futura agendada.</p>}
      </div>
      {repo && (
        <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
          <div><span className="font-medium">{cap(vocab.aluno)}:</span> {repo.alunoNome}</div>
          <div><span className="font-medium">Data:</span> {fmtBRFull(repo.dataReposicao)}</div>
          <div><span className="font-medium">{cap(vocab.turma)}:</span> {getTurmaLabel(state.turmas, repo.turmaReposicaoId)}</div>
          <div><span className="font-medium">Tipo:</span> {repo.tipo === 'aula_extra' ? 'Aula extra' : 'Reposição'}</div>
          {repo.tipo !== 'aula_extra' && <div className="text-blue-600">O direito consumido volta e a vaga é reaberta.</div>}
        </div>
      )}
      {success && <div className="bg-green-50 text-green-700 rounded-lg px-4 py-3 text-sm font-medium">{success}</div>}
      <button onClick={() => setConfirm(true)} disabled={!selectedId} className="w-full py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">Cancelar Reposição</button>
      {confirm && repo && <ConfirmModal title="Cancelar reposição?" danger message={`Cancelar a reposição de ${repo.alunoNome} em ${fmtBRFull(repo.dataReposicao)}?`} onConfirm={handleCancel} onCancel={() => setConfirm(false)} confirmLabel="Cancelar reposição" />}
    </div>
  );
}

function TabAusenciaProgramada({ state, dispatch, vocab, config }) {
  const [turmaId, setTurmaId] = useState('');
  const [alunoNome, setAlunoNome] = useState('');
  const [mesAno, setMesAno] = useState('');
  const [success, setSuccess] = useState('');

  const sorted = useMemo(() => sortTurmas(state.turmas), [state.turmas]);
  const turma = state.turmas.find((t) => t.id === turmaId);
  const daCredito = !!config?.regras?.feriasCredito;
  const qtdCredito = Number(config?.regras?.feriasCreditos) || 1;
  const validadeDias = Number(config?.regras?.feriasValidadeDias) || 30;
  const temRecessos = (config?.calendario?.recessos || []).length > 0;

  useEffect(() => { const d = new Date(); setMesAno(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }, []);

  const handleSubmit = () => {
    if (!turmaId || !alunoNome || !mesAno) return;
    dispatch({ type: 'ADD_AUSENCIA', alunoNome, turmaId, tipo: 'ferias', mesAno });
    setSuccess(`Férias de ${alunoNome} em ${getMesNome(mesAno)} registradas.`);
    setAlunoNome('');
    setTimeout(() => setSuccess(''), 4000);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-700">Ausência Programada (Férias)</h3>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
        {daCredito
          ? <>O {vocab.aluno} em férias recebe <strong>{qtdCredito} crédito{qtdCredito > 1 ? 's' : ''} de reposição</strong> e libera vagas nas aulas do mês. O prazo expira {validadeDias} dias após o fim do mês.</>
          : <>O {vocab.aluno} em férias libera vagas nas aulas do mês (sem crédito de reposição).</>}
        {temRecessos && daCredito && <div className="mt-1 text-blue-600 text-xs">Meses de recesso não geram crédito, mas ainda liberam vagas.</div>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{cap(vocab.turma)}</label>
        <select value={turmaId} onChange={(e) => { setTurmaId(e.target.value); setAlunoNome(''); }} className="w-full border border-gray-300 rounded-lg px-3 py-2">
          <option value="">— Selecione a {vocab.turma} —</option>
          {sorted.map((t) => <option key={t.id} value={t.id}>{getTurmaLabel(state.turmas, t.id)}</option>)}
        </select>
      </div>

      {turma && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{cap(vocab.aluno)}</label>
          <select value={alunoNome} onChange={(e) => setAlunoNome(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
            <option value="">— Selecione o {vocab.aluno} —</option>
            {[...turma.alunos].sort((a, b) => a.localeCompare(b, 'pt')).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mês de ausência</label>
        <input type="month" value={mesAno} onChange={(e) => setMesAno(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
      </div>

      {mesAno && daCredito && (
        <div className="text-sm text-gray-500">
          Prazo para reposição: até {fmtBRFull((() => { const d = parseDate(getLastDayOfMonth(mesAno)); d.setDate(d.getDate() + validadeDias); return dateToStr(d); })())}
        </div>
      )}

      {success && <div className="bg-green-50 text-green-700 rounded-lg px-4 py-3 text-sm font-medium">{success}</div>}

      <button onClick={handleSubmit} disabled={!turmaId || !alunoNome || !mesAno} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">Registrar Ausência</button>

      {state.ausencias.length > 0 && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <h4 className="text-sm font-semibold text-gray-600 mb-2">Ausências registradas</h4>
          <div className="space-y-2">
            {state.ausencias.map((a) => {
              const turmaAus = state.turmas.find((t) => t.id === a.turmaId);
              const [ayy, amo] = a.mesAno.split('-').map(Number);
              const firstDay = `${a.mesAno}-01`;
              const lastDay = dateToStr(new Date(ayy, amo, 0));
              const expectedDates = turmaAus ? getClassDatesInRange(turmaAus, firstDay, lastDay) : [];
              const todasDatas = expectedDates.map((date) => {
                if (isRecesso(date, config)) return { data: date, consumida: false, por: null, recesso: true };
                const vagaAberta = state.vagas.find((v) => v.ausenciaId === a.id && v.data === date);
                if (vagaAberta) return { data: date, consumida: false, por: null };
                const repoConsumiu = state.reposicoes.find((r) => r.vagaConsumedAusenciaId === a.id && r.dataReposicao === date);
                return { data: date, consumida: true, por: repoConsumiu?.alunoNome || null };
              });
              const semCredito = a.creditoReposicao === 0;
              return (
                <div key={a.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium">{a.alunoNome}</span>
                      <span className="text-gray-400 ml-2">({getTurmaLabel(state.turmas, a.turmaId)})</span>
                      <div className="text-gray-500 mt-0.5">Férias: {getMesNome(a.mesAno)} — Crédito: {semCredito ? <span className="text-red-500">indisponível</span> : a.creditoUsado ? <span className="text-green-600">usado</span> : <span className="text-amber-600">disponível</span>}</div>
                      {todasDatas.length > 0 && (
                        <div className="text-xs text-teal-600 mt-0.5">Vagas liberadas:{' '}
                          {todasDatas.map((v, i) => (
                            <span key={i}>{i > 0 && ', '}
                              {v.recesso ? <span className="text-gray-400" title="Recesso">🏠 {fmtBR(v.data)}</span>
                                : v.consumida ? <span className="text-gray-400 line-through" title={v.por ? `Ocupada por ${v.por}` : ''}>{fmtBR(v.data)}</span>
                                : <span>{fmtBR(v.data)}</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => dispatch({ type: 'DELETE_AUSENCIA', id: a.id })} className="text-red-400 hover:text-red-600 text-xs ml-2 shrink-0">Remover</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TabCreditoExtra({ state, dispatch, vocab }) {
  const [turmaId, setTurmaId] = useState('');
  const [alunoNome, setAlunoNome] = useState('');
  const [dataExpiracao, setDataExpiracao] = useState('');
  const [success, setSuccess] = useState('');
  const td = todayStr();
  const sorted = useMemo(() => sortTurmas(state.turmas), [state.turmas]);
  const turma = state.turmas.find((t) => t.id === turmaId);

  useEffect(() => { const d = new Date(); d.setDate(d.getDate() + 30); setDataExpiracao(dateToStr(d)); }, []);

  const handleSubmit = () => {
    if (!turmaId || !alunoNome || !dataExpiracao) return;
    dispatch({ type: 'ADD_CREDITO', alunoNome, turmaId, dataExpiracao });
    setSuccess(`Crédito de reposição adicionado para ${alunoNome}.`);
    setAlunoNome('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const creditos = useMemo(() => arr(state.creditos).filter((c) => !c.usado && c.dataExpiracao >= td), [state.creditos, td]);
  const expirados = useMemo(() => arr(state.creditos).filter((c) => !c.usado && c.dataExpiracao < td), [state.creditos, td]);

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-700">
        Dar um crédito de reposição avulso ao {vocab.aluno}. Ele pode usar para marcar uma reposição sem precisar de uma falta registrada.
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{cap(vocab.turma)}</label>
        <select value={turmaId} onChange={(e) => { setTurmaId(e.target.value); setAlunoNome(''); }} className="w-full border border-gray-300 rounded-lg px-3 py-2">
          <option value="">— Selecione a {vocab.turma} —</option>
          {sorted.map((t) => <option key={t.id} value={t.id}>{getTurmaLabel(state.turmas, t.id)}</option>)}
        </select>
      </div>
      {turma && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{cap(vocab.aluno)}</label>
          <select value={alunoNome} onChange={(e) => setAlunoNome(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
            <option value="">— Selecione o {vocab.aluno} —</option>
            {[...turma.alunos].sort((a, b) => a.localeCompare(b, 'pt')).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}
      {alunoNome && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data de expiração</label>
          <input type="date" value={dataExpiracao} min={td} onChange={(e) => setDataExpiracao(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
        </div>
      )}
      {success && <div className="bg-green-50 text-green-700 rounded-lg px-4 py-3 text-sm font-medium">{success}</div>}
      <button onClick={handleSubmit} disabled={!turmaId || !alunoNome || !dataExpiracao} className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed">Dar Crédito</button>

      {creditos.length > 0 && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <h4 className="text-sm font-semibold text-gray-600 mb-2">Créditos ativos</h4>
          <div className="space-y-2">
            {creditos.map((c) => (
              <div key={c.id} className="bg-gray-50 rounded-lg p-3 text-sm flex justify-between items-center">
                <div>
                  <span className="font-medium">{c.alunoNome}</span>
                  <span className="text-gray-400 ml-2">({getTurmaLabel(state.turmas, c.turmaId)})</span>
                  <div className="text-gray-500 mt-0.5">Expira: {fmtBRFull(c.dataExpiracao)}</div>
                  {c.criadoPor && <div className="text-gray-400 text-xs mt-0.5">por {c.criadoPor}</div>}
                </div>
                <button onClick={() => dispatch({ type: 'DELETE_CREDITO', id: c.id })} className="text-red-400 hover:text-red-600 text-xs ml-2 shrink-0">Remover</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {expirados.length > 0 && (
        <div className="mt-2 border-t border-gray-100 pt-3">
          <h4 className="text-sm font-semibold text-gray-400 mb-2">Expirados</h4>
          <div className="space-y-1">
            {expirados.map((c) => (
              <div key={c.id} className="bg-gray-50 rounded-lg px-3 py-2 text-sm flex justify-between items-center opacity-60">
                <div><span className="font-medium">{c.alunoNome}</span><span className="text-gray-400 ml-2 text-xs">expirou {fmtBRFull(c.dataExpiracao)}</span></div>
                <button onClick={() => dispatch({ type: 'DELETE_CREDITO', id: c.id })} className="text-red-400 hover:text-red-600 text-xs ml-2">Remover</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TabCancelarAula({ state, dispatch, vocab, config }) {
  const [turmaId, setTurmaId] = useState('');
  const [data, setData] = useState('');
  const [confirm, setConfirm] = useState(false);
  const td = todayStr();
  const sorted = useMemo(() => sortTurmas(state.turmas), [state.turmas]);
  const turma = state.turmas.find((t) => t.id === turmaId);

  const proximasDatas = useMemo(() => {
    if (!turma) return [];
    const end = new Date(); end.setDate(end.getDate() + 60);
    const jaCanc = new Set(arr(state.aulasCanceladas).filter((a) => a.turmaId === turmaId).map((a) => a.data));
    return getClassDatesInRange(turma, td, dateToStr(end)).filter((d) => !feriadoNome(d, config) && !isRecesso(d, config) && !jaCanc.has(d));
  }, [turma, turmaId, state.aulasCanceladas, td, config]);

  const previa = useMemo(() => {
    if (!turma || !data) return null;
    const mes = data.slice(0, 7);
    const ferias = new Set(arr(state.ausencias).filter((a) => a.turmaId === turmaId && a.mesAno === mes).map((a) => a.alunoNome));
    const jaFaltam = new Set(state.faltas.filter((f) => f.turmaId === turmaId && f.datas.includes(data) && (f.status === 'pendente' || f.status === 'marcada')).map((f) => f.alunoNome));
    const marcar = turma.alunos.filter((n) => !ferias.has(n) && !jaFaltam.has(n));
    const repos = state.reposicoes.filter((r) => r.turmaReposicaoId === turmaId && r.dataReposicao === data && !r.realizada);
    return { marcar, repos };
  }, [turma, turmaId, data, state.ausencias, state.faltas, state.reposicoes]);

  const handleCancelar = () => {
    if (!turmaId || !data) return;
    dispatch({ type: 'CANCEL_AULA', turmaId, data });
    setConfirm(false); setData(''); setTurmaId('');
  };

  const canceladas = useMemo(() => [...arr(state.aulasCanceladas)].sort((a, b) => b.data.localeCompare(a.data)), [state.aulasCanceladas]);

  return (
    <div className="space-y-4">
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
        Cancela uma {vocab.aula} inteira (quando ninguém pôde dar). Todos os {vocab.alunos} presentes viram falta regular, nenhuma vaga é aberta, e reposições marcadas para essa {vocab.aula} são desfeitas sem punição.
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{cap(vocab.turma)}</label>
        <select value={turmaId} onChange={(e) => { setTurmaId(e.target.value); setData(''); }} className="w-full border border-gray-300 rounded-lg px-3 py-2">
          <option value="">— Selecione a {vocab.turma} —</option>
          {sorted.map((t) => <option key={t.id} value={t.id}>{getTurmaLabel(state.turmas, t.id)}</option>)}
        </select>
      </div>
      {turma && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data da {vocab.aula}</label>
          <select value={data} onChange={(e) => setData(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
            <option value="">— Selecione a data —</option>
            {proximasDatas.map((d) => <option key={d} value={d}>{fmtBRFull(d)}</option>)}
          </select>
          {proximasDatas.length === 0 && <p className="text-xs text-gray-400 mt-1">Nenhuma {vocab.aula} futura disponível.</p>}
        </div>
      )}
      {previa && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
          <div><strong>{previa.marcar.length}</strong> {previa.marcar.length === 1 ? vocab.aluno : vocab.alunos} {previa.marcar.length === 1 ? 'será marcado' : 'serão marcados'} como falta.</div>
          {previa.repos.length > 0 && <div className="mt-1">{previa.repos.length} reposição(ões) marcada(s) para esta {vocab.aula} serão desfeitas (sem punição).</div>}
        </div>
      )}
      {!confirm ? (
        <button onClick={() => setConfirm(true)} disabled={!turmaId || !data} className="w-full py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">Cancelar {vocab.aula}</button>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
          <p className="text-sm text-red-700 font-medium">Confirmar cancelamento de {getTurmaLabel(state.turmas, turmaId)} em {fmtBRFull(data)}?</p>
          <div className="flex gap-2">
            <button onClick={handleCancelar} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Confirmar</button>
            <button onClick={() => setConfirm(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm">Voltar</button>
          </div>
        </div>
      )}
      {canceladas.length > 0 && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <h4 className="text-sm font-semibold text-gray-600 mb-2">{cap(vocab.aulas)} canceladas</h4>
          <div className="space-y-2">
            {canceladas.map((a) => (
              <div key={a.id} className="bg-gray-50 rounded-lg p-3 text-sm flex justify-between items-center gap-2">
                <div><span className="font-medium">{getTurmaLabel(state.turmas, a.turmaId)}</span><div className="text-gray-500 mt-0.5">{fmtBRFull(a.data)}</div></div>
                <button onClick={() => dispatch({ type: 'REVERT_AULA_CANCELADA', id: a.id })} className="text-xs px-2.5 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 shrink-0">Reativar</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
