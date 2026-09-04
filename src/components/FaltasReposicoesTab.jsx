import { useMemo, useState } from 'react';
import { sortTurmas, EXTENSO, ABREV, fmtBRFull, todayStr, dateToStr } from '../domain/helpers.js';
import {
  getNextOccurrences, getClassDatesInRange, getClassDatetime,
  getDiaSemanaFromDateStr, feriadoNome, recessoNome,
} from '../domain/calendario.js';
import { cap } from '../domain/vocab.js';

// Aba Faltas & Reposições — porte do SectionFaltasReposicoes (acordeão de
// grupos). Nesta fatia, Faltas ▸ Registrar está funcional; os demais entram nas
// próximas sub-fatias.
export default function FaltasReposicoesTab({ state, dispatch, vocab, config }) {
  const [openGroup, setOpenGroup] = useState('faltas');
  const [subTab, setSubTab] = useState({});
  const getSub = (g) => subTab[g] ?? 0;

  const groups = [
    { key: 'faltas', label: 'Faltas', color: 'amber', tabs: ['Registrar', 'Cancelar'],
      content: [<TabRegistrarFalta state={state} dispatch={dispatch} vocab={vocab} config={config} />, <EmBreve />] },
    { key: 'reposicoes', label: 'Reposições', color: 'blue', tabs: ['Registrar', 'Cancelar'], content: [<EmBreve />, <EmBreve />] },
    { key: 'ferias', label: 'Férias', color: 'green', tabs: ['Ausência Programada'], content: [<EmBreve />] },
    { key: 'credito', label: 'Crédito Extra', color: 'purple', tabs: ['Dar Crédito'], content: [<EmBreve />] },
    { key: 'cancelarAula', label: `Cancelar ${cap(vocab.turma)}`, color: 'red', tabs: ['Cancelar'], content: [<EmBreve />] },
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
  const occurrences = useMemo(() => (!turma ? [] : getNextOccurrences(turma.diaSemana, 8)), [turma]);
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
          {sorted.map((t) => <option key={t.id} value={t.id}>{EXTENSO[t.diaSemana]} {t.horario}{t.observacao ? ` (${t.observacao})` : ''}</option>)}
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
