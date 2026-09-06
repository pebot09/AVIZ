import { useMemo, useState } from 'react';
import {
  arr, sortTurmas, EXTENSO, fmtBR, fmtBRFull, todayStr, dateToStr,
  turmaShortLabel, getFaltaExpiry, getMesNome,
} from '../domain/helpers.js';
import { getDiaSemanaFromDateStr, horarioNaData } from '../domain/calendario.js';
import { calcOccupancy, fmtDatesText } from '../domain/reposicao.js';
import { construirDados } from '../domain/painel.js';
import { cap } from '../domain/vocab.js';
import Modal from './Modal.jsx';

// Lista atual do painel — porte do PainelVisual do Passarinho.
// Acordeão: FALTAS (+ JÁ MARCADAS) · REPOSIÇÕES · VAGAS · TURMAS · OBSERVAÇÕES,
// cada item abrindo um modal de detalhes.
export default function PainelVisual({ state, dispatch, vocab, config }) {
  const td = todayStr();
  const sorted = useMemo(() => sortTurmas(state.turmas), [state.turmas]);
  const [open, setOpen] = useState({ faltas: false, reposicoes: false, vagas: false, turmas: false, obs: false });
  const [det, setDet] = useState(null); // { tipo, obj }
  const toggle = (k) => setOpen((p) => ({ ...p, [k]: !p[k] }));

  const in7 = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 7); return dateToStr(d); }, []);
  const doisDiasAtras = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 2); return dateToStr(d); }, []);

  const dados = useMemo(() => construirDados(state, config, td, in7, doisDiasAtras), [state, config, td, in7, doisDiasAtras]);
  const { combined, marcadasGrupos, reposAtivas, vagasGrupos, obs } = dados;

  const BlockHeader = ({ children, sub, sKey, count }) => (
    <div
      onClick={sKey ? () => toggle(sKey) : undefined}
      className={`px-4 py-2.5 font-bold text-sm tracking-widest flex items-center justify-between ${
        sub ? 'bg-gray-100 text-gray-500 border-t border-gray-200 text-xs cursor-default'
            : `bg-gray-800 text-white ${open[sKey] ? 'rounded-t-xl' : 'rounded-xl'} ${sKey ? 'cursor-pointer hover:bg-gray-700 transition-colors' : ''}`
      }`}
    >
      <span>
        {children}
        {count !== undefined && count > 0 && <span className="ml-1.5 font-normal opacity-60 text-xs">({count})</span>}
      </span>
      {sKey && <span className="opacity-50 text-xs">{open[sKey] ? '▲' : '▼'}</span>}
    </div>
  );

  const obsColors = {
    red: 'bg-red-50 text-red-700 border-red-200', amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200', teal: 'bg-teal-50 text-teal-700 border-teal-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
  };
  const obsIcons = { red: '🔴', amber: '⚠️', blue: 'ℹ️', teal: '✦', orange: '⏱️' };

  return (
    <div className="space-y-4">
      <DetalheModal det={det} setDet={setDet} state={state} dispatch={dispatch} vocab={vocab} config={config} td={td} in7={in7} />

      {/* FALTAS */}
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <BlockHeader sKey="faltas" count={combined.length + marcadasGrupos.length}>FALTAS</BlockHeader>
        {open.faltas && (
          <>
            {combined.length === 0 && marcadasGrupos.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-400 italic">Nenhuma falta registrada.</div>
            )}
            <div className="divide-y divide-gray-100">
              {combined.map(({ tipo, obj }, i) => {
                const lbl = turmaShortLabel(state.turmas.find((x) => x.id === obj.turmaId));
                if (tipo === 'falta') {
                  const datasOrdenadas = [...obj.datas].sort();
                  const expirando = obj.proxExpiry >= td && obj.proxExpiry <= in7;
                  return (
                    <div key={i} onClick={() => setDet({ tipo: 'falta', obj })}
                      className={`px-4 py-3 cursor-pointer transition-colors ${expirando ? 'bg-amber-50 hover:bg-amber-100' : 'bg-white hover:bg-gray-50'}`}>
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-semibold text-gray-800">{obj.alunoNome}</span>
                        <span className="text-xs text-gray-400 shrink-0">{lbl}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-0.5">
                        Falta: <span className="font-bold text-gray-900">{fmtDatesText(datasOrdenadas)}</span>
                        {expirando && <span className="ml-2 text-xs text-amber-600 font-medium">· expira {fmtBRFull(obj.proxExpiry)}</span>}
                      </div>
                      {obj.faltas.some((f) => f.semAntecedencia) && (
                        <div className="mt-1"><span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">sem antecedência</span></div>
                      )}
                    </div>
                  );
                }
                return (
                  <div key={i} className="px-4 py-3 bg-white">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-semibold text-gray-800">{obj.alunoNome}</span>
                      <span className="text-xs text-gray-400 shrink-0">{lbl}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">Férias: <span className="font-medium">{getMesNome(obj.mesAno).toLowerCase()}</span></div>
                  </div>
                );
              })}
            </div>

            {marcadasGrupos.length > 0 && (
              <>
                <BlockHeader sub>JÁ MARCADAS</BlockHeader>
                <div className="divide-y divide-gray-100">
                  {marcadasGrupos.map((g, i) => (
                    <div key={i} onClick={() => setDet({ tipo: 'marcada', obj: g })}
                      className="px-4 py-3 bg-white cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-medium text-gray-500">{g.alunoNome}</span>
                        <span className="text-xs text-gray-400 shrink-0">{turmaShortLabel(state.turmas.find((x) => x.id === g.turmaId))}</span>
                      </div>
                      <div className="text-sm text-gray-400 mt-0.5">Falta: {fmtDatesText([...g.datas].sort())}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* REPOSIÇÕES */}
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <BlockHeader sKey="reposicoes" count={reposAtivas.length}>REPOSIÇÕES</BlockHeader>
        {open.reposicoes && (
          <>
            {reposAtivas.length === 0 && <div className="px-4 py-3 text-sm text-gray-400 italic">Nenhuma reposição agendada.</div>}
            <div className="divide-y divide-gray-100">
              {reposAtivas.map((r, i) => {
                const dia = getDiaSemanaFromDateStr(r.dataReposicao);
                const origemLbl = turmaShortLabel(state.turmas.find((t) => t.id === r.turmaOrigemId));
                const isExtra = r.tipo === 'aula_extra';
                const isFerias = r.tipo === 'reposicao_ferias';
                const ocupacao = calcOccupancy(r.turmaReposicaoId, r.dataReposicao, state);
                return (
                  <div key={i} onClick={() => setDet({ tipo: 'reposicao', obj: r })}
                    className="px-4 py-3 bg-white cursor-pointer hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-semibold text-gray-800">{r.alunoNome}</span>
                      <span className="text-xs text-gray-400 shrink-0">{origemLbl}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">
                      <span className="text-gray-400">{isExtra ? `${cap(vocab.aula)} extra:` : 'Repõe:'}</span>{' '}
                      <span className="font-bold text-gray-900">
                        {EXTENSO[dia]}, {fmtBR(r.dataReposicao)}, {horarioNaData(r.turmaReposicaoId, r.dataReposicao, state.turmas)}
                      </span>
                      {ocupacao !== null && <span className="ml-2 text-xs text-gray-500">({ocupacao} {vocab.alunos} esperados)</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      {(r.vagaExtra || r.semVagaOficial) && !r.vagaConsumedFaltaId && !r.vagaConsumedAusenciaId && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">vaga extra</span>
                      )}
                      {isFerias && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">🏖️ crédito de férias</span>}
                      {(isExtra || r.semFaltaVinculada) && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isExtra ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                          {isExtra ? `${cap(vocab.aula)} extra` : 'Sem falta vinculada'}
                        </span>
                      )}
                      {isExtra && (
                        <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'MARK_PAGO', id: r.id }); }}
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border transition-colors ${r.pago ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-300 hover:border-green-500 hover:text-green-600'}`}>
                          {r.pago ? '✓ PAGO' : 'PAGO'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* VAGAS */}
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <BlockHeader sKey="vagas" count={vagasGrupos.length}>VAGAS</BlockHeader>
        {open.vagas && (
          <>
            {vagasGrupos.length === 0 && <div className="px-4 py-3 text-sm text-gray-400 italic">Nenhuma vaga aberta.</div>}
            <div className="divide-y divide-gray-100">
              {vagasGrupos.map((v, i) => {
                const dia = getDiaSemanaFromDateStr(v.data);
                const todaCancelada = v.vagas.every((vg) => vg.cancelada);
                return (
                  <div key={i} onClick={() => setDet({ tipo: 'vaga', obj: v })}
                    className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors flex justify-between items-center gap-2 ${todaCancelada ? 'bg-gray-50 opacity-60' : 'bg-white'}`}>
                    <div className="min-w-0">
                      <span className={`font-bold ${todaCancelada ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{EXTENSO[dia]}, {fmtBR(v.data)}</span>
                      <span className="text-gray-500 ml-2 text-sm">{horarioNaData(v.turmaId, v.data, state.turmas)}</span>
                      {todaCancelada && <span className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">oculta dos {vocab.alunos}</span>}
                    </div>
                    {v.count > 1 && <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full shrink-0">{v.count} vagas</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* TURMAS */}
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <BlockHeader sKey="turmas" count={sorted.length}>{cap(vocab.turmas).toUpperCase()}</BlockHeader>
        {open.turmas && (
          <div className="divide-y divide-gray-100">
            {sorted.map((t, i) => {
              const nAlunos = arr(t.alunos).length;
              const over = nAlunos > t.capacidade;
              const full = nAlunos === t.capacidade;
              return (
                <div key={i} className="px-4 py-2.5 bg-white flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-gray-700">{turmaShortLabel(t)}</span>
                    {t.observacao && <span className="text-xs text-gray-400 truncate">({t.observacao})</span>}
                  </div>
                  <span className={`text-sm font-medium shrink-0 ${over ? 'text-red-600' : full ? 'text-amber-600' : 'text-gray-500'}`}>
                    {nAlunos}/{t.capacidade}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* OBSERVAÇÕES */}
      {obs.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <BlockHeader sKey="obs" count={obs.length}>OBSERVAÇÕES</BlockHeader>
          {open.obs && (
            <div className="divide-y divide-gray-100">
              {obs.map((o, i) => (
                <div key={i} className={`px-4 py-3 text-sm border-l-4 ${obsColors[o.level]} border-l-current`}>
                  {obsIcons[o.level]} {o.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Modal de detalhes ----
export function DetalheModal({ det, setDet, state, dispatch, vocab, config, td, in7 }) {
  if (!det) return null;
  const { tipo, obj } = det;
  const lblDe = (id) => turmaShortLabel(state.turmas.find((x) => x.id === id));
  let title = '';
  let body = null;

  if (tipo === 'falta') {
    title = `${obj.alunoNome} — ${lblDe(obj.turmaId)}`;
    body = (
      <div className="space-y-2">
        {[...obj.faltas].sort((a, b) => a.datas[0].localeCompare(b.datas[0])).map((f) => {
          const exp = getFaltaExpiry(f, config);
          const expirando = exp >= td && exp <= in7;
          return (
            <div key={f.id} className={`rounded-lg px-3 py-2 text-sm ${expirando ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
              <div className="font-semibold text-gray-800 flex items-center gap-2 flex-wrap">
                📅 {fmtBRFull(f.datas[0])}
                {f.semAntecedencia && <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">sem antecedência</span>}
                {f.cancelamentoId && <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">{vocab.aula} cancelada</span>}
              </div>
              <div className="text-gray-500 mt-0.5">
                Expira em: {fmtBRFull(exp)}
                {expirando && <span className="ml-1 text-amber-600 font-medium">⚠️ em breve</span>}
              </div>
              <CriadoPor por={f.criadoPor} em={f.criadoEm} />
            </div>
          );
        })}
      </div>
    );
  }

  if (tipo === 'marcada') {
    const repo = obj.faltas[0]?.reposicaoId ? arr(state.reposicoes).find((r) => r.id === obj.faltas[0].reposicaoId) : null;
    title = `${obj.alunoNome} — ${lblDe(obj.turmaId)}`;
    body = (
      <div className="space-y-2 text-sm">
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <div className="text-gray-500 text-xs mb-1">Falta(s) marcada(s)</div>
          <div className="font-semibold text-gray-800">{fmtDatesText([...obj.datas].sort())}</div>
        </div>
        {repo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <div className="text-blue-600 text-xs mb-1">Reposição agendada</div>
            <div className="font-semibold text-gray-800">{EXTENSO[getDiaSemanaFromDateStr(repo.dataReposicao)]}, {fmtBRFull(repo.dataReposicao)}</div>
            <div className="text-gray-600">{lblDe(repo.turmaReposicaoId)} · {horarioNaData(repo.turmaReposicaoId, repo.dataReposicao, state.turmas)}</div>
          </div>
        )}
      </div>
    );
  }

  if (tipo === 'reposicao') {
    const r = obj;
    const dia = getDiaSemanaFromDateStr(r.dataReposicao);
    const isExtra = r.tipo === 'aula_extra';
    const isFerias = r.tipo === 'reposicao_ferias';
    const faltaVinc = r.faltaId ? arr(state.faltas).find((f) => f.id === r.faltaId) : null;
    const faltaLiberou = r.vagaConsumedFaltaId ? arr(state.faltas).find((f) => f.id === r.vagaConsumedFaltaId) : null;
    const ausLiberou = r.vagaConsumedAusenciaId ? arr(state.ausencias).find((a) => a.id === r.vagaConsumedAusenciaId) : null;
    const ausVinc = isFerias && r.ausenciaId ? arr(state.ausencias).find((a) => a.id === r.ausenciaId) : null;
    title = r.alunoNome;
    body = (
      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <div className="text-gray-400 text-xs">{cap(vocab.turma)} origem</div>
            <div className="font-semibold">{lblDe(r.turmaOrigemId)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <div className="text-gray-400 text-xs">{cap(vocab.turma)} reposição</div>
            <div className="font-semibold">{lblDe(r.turmaReposicaoId)}</div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <div className="text-blue-600 text-xs mb-0.5">{isExtra ? `${cap(vocab.aula)} extra em` : 'Repõe em'}</div>
          <div className="font-bold text-gray-900">
            {EXTENSO[dia]}, {fmtBRFull(r.dataReposicao)}, {horarioNaData(r.turmaReposicaoId, r.dataReposicao, state.turmas)}
          </div>
        </div>
        {ausVinc && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
            <div className="text-teal-600 text-xs mb-0.5">🏖️ Crédito de férias</div>
            <div className="font-semibold text-gray-800">Férias de {getMesNome(ausVinc.mesAno)}</div>
          </div>
        )}
        {faltaVinc && (
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <div className="text-gray-400 text-xs">Falta vinculada</div>
            <div className="font-semibold">{fmtBRFull(faltaVinc.datas[0])}</div>
          </div>
        )}
        {faltaLiberou ? (
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <div className="text-green-600 text-xs mb-0.5">Vaga liberada por</div>
            <div className="font-semibold text-gray-800">{faltaLiberou.alunoNome} ({lblDe(faltaLiberou.turmaId)})</div>
            <div className="text-gray-500 text-xs mt-0.5">Falta de {fmtBRFull(faltaLiberou.datas[0])}</div>
          </div>
        ) : ausLiberou ? (
          <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
            <div className="text-teal-600 text-xs mb-0.5">🏖️ Vaga liberada por férias</div>
            <div className="font-semibold text-gray-800">{ausLiberou.alunoNome} ({getMesNome(ausLiberou.mesAno)})</div>
          </div>
        ) : !isFerias ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <div className="text-amber-700 text-xs font-medium">
              {isExtra ? `${cap(vocab.aula)} extra — sem vaga vinculada` : 'Data extra — nenhuma falta liberou esta vaga'}
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-2 flex-wrap">
          {isFerias && <span className="bg-teal-100 text-teal-700 text-xs font-medium px-2 py-0.5 rounded-full">🏖️ Reposição de férias</span>}
          {isExtra && <span className="bg-purple-100 text-purple-700 text-xs font-medium px-2 py-0.5 rounded-full">{cap(vocab.aula)} extra</span>}
          {r.semFaltaVinculada && <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">Sem falta vinculada</span>}
          {isExtra && (
            <button
              onClick={() => { dispatch({ type: 'MARK_PAGO', id: r.id }); setDet((p) => (p ? { ...p, obj: { ...r, pago: !r.pago } } : null)); }}
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border transition-colors ${r.pago ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-300 hover:border-green-500 hover:text-green-600'}`}
            >{r.pago ? '✓ PAGO' : 'PAGO'}</button>
          )}
        </div>
        <CriadoPor por={r.criadoPor} em={r.criadoEm} />
      </div>
    );
  }

  if (tipo === 'vaga') {
    const v = obj;
    const dia = getDiaSemanaFromDateStr(v.data);
    const origens = v.vagas.map((vg) => {
      if (vg.ausenciaId) {
        const aus = arr(state.ausencias).find((a) => a.id === vg.ausenciaId);
        return aus ? `${aus.alunoNome} (férias)` : null;
      }
      if (vg.faltaId) {
        const f = arr(state.faltas).find((x) => x.id === vg.faltaId);
        return f ? f.alunoNome : null;
      }
      return vg.vagaExtra ? 'vaga extra' : null;
    }).filter(Boolean);
    const todaCancelada = v.vagas.every((vg) => vg.cancelada);
    title = `Vagas — ${lblDe(v.turmaId)}`;
    body = (
      <div className="space-y-2 text-sm">
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <div className="text-gray-400 text-xs">Data</div>
          <div className="font-bold text-gray-900">{EXTENSO[dia]}, {fmtBRFull(v.data)} · {horarioNaData(v.turmaId, v.data, state.turmas)}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <div className="text-blue-600 text-xs mb-1">{v.count} vaga{v.count > 1 ? 's' : ''} gerada{v.count > 1 ? 's' : ''} por</div>
          {origens.length ? origens.map((a, i) => <div key={i} className="font-semibold text-gray-800">· {a}</div>)
            : <div className="text-gray-400 text-xs italic">vaga extra</div>}
        </div>
        <button
          onClick={() => { dispatch({ type: 'CANCEL_VAGAS_SLOT', turmaId: v.turmaId, data: v.data, cancelada: !todaCancelada }); setDet(null); }}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${todaCancelada ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
          {todaCancelada ? `Reabrir vagas para ${vocab.alunos}` : `Ocultar vagas dos ${vocab.alunos}`}
        </button>
      </div>
    );
  }

  return <Modal title={title} onClose={() => setDet(null)}>{body}</Modal>;
}

function CriadoPor({ por, em }) {
  if (!por && !em) return null;
  const quando = em ? new Date(em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
  const txt = [por ? `marcado por ${por}` : null, quando].filter(Boolean).join(' · ');
  return <div className="text-xs text-gray-400 text-right mt-1 pt-2 border-t border-gray-100">{txt}</div>;
}
