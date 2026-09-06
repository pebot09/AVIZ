import { useMemo, useState } from 'react';
import { arr, parseDate, dateToStr, todayStr, fmtBRFull, turmaShortLabel, getTurmaLabel } from '../domain/helpers.js';
import { feriadoNome, recessoNome } from '../domain/calendario.js';
import { computeResumoDia } from '../domain/resumo.js';

// Resumo do dia — porte do ResumoDia do Passarinho.
// Hoje e futuro saem ao vivo do estado; dias passados vêm do resumo congelado
// (imutável), para o histórico não mudar quando o cadastro muda depois.
export default function ResumoDia({ state, vocab, config }) {
  const td = todayStr();
  const [viewDate, setViewDate] = useState(td);

  const desloca = (base, d) => { const x = parseDate(base); x.setDate(x.getDate() + d); return dateToStr(x); };
  const isHoje = viewDate === td;
  const isFuturo = viewDate > td;
  const isPassado = viewDate < td;

  const congelado = isPassado ? (state.resumosDiarios || {})[viewDate] : null;
  const resumo = useMemo(
    () => (isPassado ? (congelado ? congelado.turmas : null) : computeResumoDia(state, viewDate, config)),
    [isPassado, congelado, state, viewDate, config],
  );

  const diaNome = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][parseDate(viewDate).getDay()];
  const fer = feriadoNome(viewDate, config);
  const rec = !fer ? recessoNome(viewDate, config) : null;

  const repondoLabel = (r) => {
    const orig = arr(state.turmas).find((t) => t.id === r.origemTurmaId);
    return orig ? `${r.nome} (${turmaShortLabel(orig)})` : r.nome;
  };

  return (
    <div className="mt-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden fade-in">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
        <button onClick={() => setViewDate((v) => desloca(v, -1))}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-600 text-lg" aria-label="Dia anterior">‹</button>
        <div className="flex flex-col items-center">
          <div className="relative">
            <span className="text-sm font-semibold text-gray-800">{diaNome}, {fmtBRFull(viewDate)}</span>
            <input type="date" value={viewDate} min={desloca(td, -100)} max={desloca(td, 60)}
              onChange={(e) => { if (e.target.value) setViewDate(e.target.value); }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" aria-label="Escolher data" />
          </div>
          {!isHoje && <button onClick={() => setViewDate(td)} className="text-xs text-blue-600 hover:underline mt-0.5">Voltar para hoje</button>}
        </div>
        <button onClick={() => setViewDate((v) => desloca(v, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-600 text-lg" aria-label="Próximo dia">›</button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {rec ? (
          <div className="px-6 py-8 text-center text-amber-600 text-sm font-medium">🏠 {rec}</div>
        ) : fer ? (
          <div className="px-6 py-8 text-center text-amber-600 text-sm font-medium">🎌 {fer}</div>
        ) : resumo === null ? (
          <div className="px-6 py-8 text-center text-gray-400 text-sm">Sem registro deste dia.</div>
        ) : resumo.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-400 text-sm">Sem {vocab.aulas} neste dia.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {isFuturo && (
              <div className="px-4 py-2 text-xs text-amber-600 bg-amber-50">Dia futuro — mostra o que já está marcado até agora.</div>
            )}
            {resumo.map((item, idx) => {
              const turma = arr(state.turmas).find((t) => t.id === item.turmaId);
              const titulo = turma ? turmaShortLabel(turma) : getTurmaLabel(state.turmas, item.turmaId);
              const presentes = item.presentes || [];
              const faltaram = item.faltaram || [];
              const emFerias = item.ferias || []; // resumos congelados antigos não têm este campo
              const repondo = item.repondo || [];
              return (
                <div key={item.turmaId || idx} className="px-4 py-3 space-y-0.5">
                  <div className="font-semibold text-gray-800 text-sm mb-1">
                    {titulo}{' '}
                    {item.cancelada
                      ? <span className="text-red-500 font-normal">🚫 {vocab.aula} cancelada</span>
                      : <span className="text-gray-400 font-normal">({item.esperados})</span>}
                  </div>
                  {!item.cancelada && presentes.length > 0 && (
                    <div className="text-sm text-gray-600"><span className="text-gray-400 text-xs">Presentes&nbsp;&nbsp;</span>{presentes.join(', ')}</div>
                  )}
                  {faltaram.length > 0 && (
                    <div className="text-sm text-red-600"><span className="text-red-400 text-xs">Faltam&nbsp;&nbsp;</span>{faltaram.join(', ')}</div>
                  )}
                  {emFerias.length > 0 && (
                    <div className="text-sm text-teal-600"><span className="text-teal-400 text-xs">🏖️ Férias&nbsp;&nbsp;</span>{emFerias.join(', ')}</div>
                  )}
                  {repondo.length > 0 && (
                    <div className="text-sm text-blue-600"><span className="text-blue-400 text-xs">Repondo&nbsp;&nbsp;</span>{repondo.map(repondoLabel).join(', ')}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
