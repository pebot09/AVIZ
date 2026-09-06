import { useState } from 'react';
import { arr, todayStr, fmtBR, fmtBRFull, turmaShortLabel, getMesNome } from '../domain/helpers.js';
import { horarioNaData } from '../domain/calendario.js';
import { construirDados } from '../domain/painel.js';
import Modal from './Modal.jsx';

// Snapshot = uma foto da lista atual, guardada para consulta depois.
// Diferente do original, que salvava um bloco de texto bruto: aqui grava dados
// estruturados, com os rótulos já resolvidos. Isso permite mostrar formatado, e
// mantém a foto legível mesmo se a turma for renomeada ou excluída depois.
export function snapshotFromState(state, config) {
  const td = todayStr();
  const dIn7 = new Date(); dIn7.setDate(dIn7.getDate() + 7);
  const d2 = new Date(); d2.setDate(d2.getDate() - 2);
  const { combined, marcadasGrupos, reposAtivas, vagasGrupos, obs } =
    construirDados(state, config, td, dateStr(dIn7), dateStr(d2));

  const lbl = (id) => turmaShortLabel(arr(state.turmas).find((t) => t.id === id));

  return {
    faltas: combined.filter((c) => c.tipo === 'falta').map(({ obj }) => ({
      aluno: obj.alunoNome, turma: lbl(obj.turmaId), datas: [...obj.datas].sort(),
      semAntecedencia: obj.faltas.some((f) => f.semAntecedencia),
    })),
    ferias: combined.filter((c) => c.tipo === 'ausencia').map(({ obj }) => ({
      aluno: obj.alunoNome, turma: lbl(obj.turmaId), mes: getMesNome(obj.mesAno),
    })),
    marcadas: marcadasGrupos.map((g) => ({ aluno: g.alunoNome, turma: lbl(g.turmaId), datas: [...g.datas].sort() })),
    reposicoes: reposAtivas.map((r) => ({
      aluno: r.alunoNome, origem: lbl(r.turmaOrigemId), destino: lbl(r.turmaReposicaoId),
      data: r.dataReposicao, hora: horarioNaData(r.turmaReposicaoId, r.dataReposicao, state.turmas),
      extra: r.tipo === 'aula_extra', pago: !!r.pago,
    })),
    vagas: vagasGrupos.map((v) => ({
      turma: lbl(v.turmaId), data: v.data, hora: horarioNaData(v.turmaId, v.data, state.turmas), count: v.count,
    })),
    turmas: arr(state.turmas).map((t) => ({ label: turmaShortLabel(t), alunos: arr(t.alunos).length, capacidade: t.capacidade })),
    obs: obs.map((o) => ({ level: o.level, text: o.text })),
  };
}

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---- Modal: lista, salva e mostra snapshots ----
export default function SnapshotsModal({ state, dispatch, config, vocab, onClose }) {
  const [rotulo, setRotulo] = useState('');
  const [vendo, setVendo] = useState(null);
  const [salvo, setSalvo] = useState(false);
  const snaps = arr(state.snapshots);

  const salvar = () => {
    dispatch({ type: 'SAVE_SNAPSHOT', label: rotulo.trim() || fmtBRFull(todayStr()), dados: snapshotFromState(state, config) });
    setRotulo('');
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
  };

  if (vendo) {
    return (
      <Modal title={vendo.label} onClose={() => setVendo(null)}>
        <SnapshotView snap={vendo} vocab={vocab} />
        <div className="mt-3 flex justify-end">
          <button onClick={() => setVendo(null)} className="px-3 py-1.5 bg-gray-200 rounded-lg text-sm hover:bg-gray-300">Voltar</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Fotos da lista" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          Guarda como está a lista hoje, para consultar depois. Fica só aqui — não muda nada no funcionamento.
        </p>
        <div className="flex gap-2">
          <input value={rotulo} onChange={(e) => setRotulo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') salvar(); }}
            placeholder="Nome desta foto (opcional)"
            className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <button onClick={salvar} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 whitespace-nowrap shrink-0">Salvar agora</button>
        </div>
        {salvo && <div className="bg-green-50 text-green-700 rounded-lg px-3 py-2 text-sm">Foto salva.</div>}

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {snaps.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Nenhuma foto salva ainda.</p>}
          {snaps.map((s) => (
            <div key={s.id} className="flex justify-between items-center bg-gray-50 rounded-lg p-3 gap-2">
              <div className="min-w-0">
                <div className="font-medium text-sm text-gray-800 truncate">{s.label}</div>
                <div className="text-xs text-gray-400">{new Date(s.ts).toLocaleString('pt-BR')}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setVendo(s)} className="text-blue-600 hover:text-blue-800 text-sm px-2">Ver</button>
                <button onClick={() => { if (confirm(`Excluir a foto "${s.label}"?`)) dispatch({ type: 'DELETE_SNAPSHOT', id: s.id }); }}
                  className="text-red-400 hover:text-red-600 text-sm px-2">Excluir</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ---- Render formatado de um snapshot ----
function Secao({ titulo, count, children }) {
  if (!count) return null;
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-3 py-1.5 bg-gray-100 text-xs font-bold tracking-wider text-gray-500">
        {titulo} <span className="font-normal opacity-60">({count})</span>
      </div>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  );
}

function SnapshotView({ snap, vocab }) {
  const d = snap.dados;
  if (!d) return <p className="text-sm text-gray-400 text-center py-6">Esta foto não tem conteúdo.</p>;

  const obsColors = {
    red: 'bg-red-50 text-red-700', amber: 'bg-amber-50 text-amber-700', blue: 'bg-blue-50 text-blue-700',
    teal: 'bg-teal-50 text-teal-700', orange: 'bg-orange-50 text-orange-700',
  };

  return (
    <div className="space-y-3 text-sm max-h-[70vh] overflow-y-auto">
      <Secao titulo="FALTAS" count={arr(d.faltas).length + arr(d.ferias).length}>
        {arr(d.faltas).map((f, i) => (
          <div key={`f${i}`} className="px-3 py-2 flex justify-between items-start gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-gray-800">{f.aluno}</div>
              <div className="text-gray-600 text-xs">{f.datas.map(fmtBR).join(', ')}</div>
              {f.semAntecedencia && <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">sem antecedência</span>}
            </div>
            <span className="text-xs text-gray-400 shrink-0">{f.turma}</span>
          </div>
        ))}
        {arr(d.ferias).map((f, i) => (
          <div key={`v${i}`} className="px-3 py-2 flex justify-between items-start gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-gray-800">{f.aluno}</div>
              <div className="text-gray-600 text-xs">Férias: {String(f.mes).toLowerCase()}</div>
            </div>
            <span className="text-xs text-gray-400 shrink-0">{f.turma}</span>
          </div>
        ))}
      </Secao>

      <Secao titulo="JÁ MARCADAS" count={arr(d.marcadas).length}>
        {arr(d.marcadas).map((m, i) => (
          <div key={i} className="px-3 py-2 flex justify-between items-start gap-2">
            <div className="min-w-0">
              <div className="font-medium text-gray-500">{m.aluno}</div>
              <div className="text-gray-400 text-xs">{m.datas.map(fmtBR).join(', ')}</div>
            </div>
            <span className="text-xs text-gray-400 shrink-0">{m.turma}</span>
          </div>
        ))}
      </Secao>

      <Secao titulo="REPOSIÇÕES" count={arr(d.reposicoes).length}>
        {arr(d.reposicoes).map((r, i) => (
          <div key={i} className="px-3 py-2 flex justify-between items-start gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-gray-800">{r.aluno}</div>
              <div className="text-gray-600 text-xs">
                {r.extra ? `${vocab.aula} extra` : 'Repõe'}: {fmtBR(r.data)} {r.hora} · {r.destino}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {r.extra && <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${r.pago ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{r.pago ? 'pago' : 'não pago'}</span>}
              <span className="text-xs text-gray-400">{r.origem}</span>
            </div>
          </div>
        ))}
      </Secao>

      <Secao titulo="VAGAS" count={arr(d.vagas).length}>
        {arr(d.vagas).map((v, i) => (
          <div key={i} className="px-3 py-2 flex justify-between items-center gap-2">
            <span className="text-gray-800"><span className="font-medium">{fmtBR(v.data)}</span> <span className="text-gray-500">{v.hora}</span> · {v.turma}</span>
            {v.count > 1 && <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full shrink-0">{v.count}</span>}
          </div>
        ))}
      </Secao>

      <Secao titulo={cap2(vocab.turmas)} count={arr(d.turmas).length}>
        {arr(d.turmas).map((t, i) => (
          <div key={i} className="px-3 py-1.5 flex justify-between items-center gap-2">
            <span className="text-gray-700">{t.label}</span>
            <span className="text-gray-500 text-xs">{t.alunos}/{t.capacidade}</span>
          </div>
        ))}
      </Secao>

      <Secao titulo="OBSERVAÇÕES" count={arr(d.obs).length}>
        {arr(d.obs).map((o, i) => (
          <div key={i} className={`px-3 py-2 text-xs ${obsColors[o.level] || 'bg-gray-50 text-gray-600'}`}>{o.text}</div>
        ))}
      </Secao>
    </div>
  );
}

function cap2(s) { return s ? s.toUpperCase() : ''; }
