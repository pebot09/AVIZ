import { useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import { saveConfig } from '../lib/store.js';
import { feriadosNacionais } from '../domain/calendario.js';
import { fmtBRFull, arr } from '../domain/helpers.js';

// Configurações do dono. Por ora: Calendário (recessos, feriados municipais e
// quais feriados nacionais paralisam). As demais regras entram aqui depois.
export default function ConfigScreen({ tenant, config, dispatch, onClose }) {
  const cal = config?.calendario || {};
  const [recessos, setRecessos] = useState(arr(cal.recessos));
  const [municipais, setMunicipais] = useState(arr(cal.feriadosMunicipais));
  const [ignorados, setIgnorados] = useState(new Set(arr(cal.feriadosIgnorados)));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const anoAtual = new Date().getFullYear();
  const nacionais = useMemo(() => {
    const juntos = { ...feriadosNacionais(anoAtual), ...feriadosNacionais(anoAtual + 1) };
    return Object.entries(juntos).sort((a, b) => a[0].localeCompare(b[0]));
  }, [anoAtual]);

  const setRecesso = (i, patch) => setRecessos((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setMunicipal = (i, patch) => setMunicipais((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const toggleIgnorado = (data) => setIgnorados((s) => { const n = new Set(s); n.has(data) ? n.delete(data) : n.add(data); return n; });

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const calendario = {
        recessos: recessos.filter((r) => r.de && r.ate).map((r) => ({ de: r.de, ate: r.ate, nome: (r.nome || 'Recesso').trim() })),
        feriadosMunicipais: municipais.filter((m) => m.data).map((m) => ({ data: m.data, nome: (m.nome || 'Feriado').trim() })),
        feriadosIgnorados: [...ignorados],
      };
      await saveConfig(tenant, { calendario });
      dispatch({ type: 'CLEANUP' }); // recesso/feriado mudam as vagas
      onClose();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal title="Configurações — Calendário" onClose={onClose}>
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        {/* Recessos */}
        <section>
          <h4 className="font-semibold text-gray-800 text-sm mb-1">Recessos</h4>
          <p className="text-xs text-gray-500 mb-2">Períodos sem aula. Meses tocados por um recesso não geram crédito de férias.</p>
          <div className="space-y-2">
            {recessos.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 bg-gray-50 rounded-lg p-2">
                <input type="date" value={r.de || ''} onChange={(e) => setRecesso(i, { de: e.target.value })} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                <span className="text-gray-400 text-xs">até</span>
                <input type="date" value={r.ate || ''} onChange={(e) => setRecesso(i, { ate: e.target.value })} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                <input value={r.nome || ''} onChange={(e) => setRecesso(i, { nome: e.target.value })} placeholder="Nome (ex.: Recesso de julho)" className="flex-1 min-w-[8rem] border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                <button onClick={() => setRecessos((rs) => rs.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs px-1">remover</button>
              </div>
            ))}
          </div>
          <button onClick={() => setRecessos((rs) => [...rs, { de: '', ate: '', nome: '' }])} className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium">+ Adicionar recesso</button>
        </section>

        {/* Feriados municipais */}
        <section>
          <h4 className="font-semibold text-gray-800 text-sm mb-1">Feriados municipais</h4>
          <p className="text-xs text-gray-500 mb-2">Feriados da sua cidade (os nacionais já são reconhecidos automaticamente).</p>
          <div className="space-y-2">
            {municipais.map((m, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 bg-gray-50 rounded-lg p-2">
                <input type="date" value={m.data || ''} onChange={(e) => setMunicipal(i, { data: e.target.value })} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                <input value={m.nome || ''} onChange={(e) => setMunicipal(i, { nome: e.target.value })} placeholder="Nome do feriado" className="flex-1 min-w-[8rem] border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                <button onClick={() => setMunicipais((ms) => ms.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs px-1">remover</button>
              </div>
            ))}
          </div>
          <button onClick={() => setMunicipais((ms) => [...ms, { data: '', nome: '' }])} className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium">+ Adicionar feriado</button>
        </section>

        {/* Feriados nacionais — paralisa ou não */}
        <section>
          <h4 className="font-semibold text-gray-800 text-sm mb-1">Feriados nacionais</h4>
          <p className="text-xs text-gray-500 mb-2">Desmarque um feriado se a sua escola funciona normalmente nele.</p>
          <div className="space-y-1">
            {nacionais.map(([data, nome]) => (
              <label key={data} className="flex items-center gap-2 text-sm py-1">
                <input type="checkbox" checked={!ignorados.has(data)} onChange={() => toggleIgnorado(data)} className="rounded" />
                <span className={ignorados.has(data) ? 'text-gray-400 line-through' : 'text-gray-700'}>{fmtBRFull(data)} — {nome}</span>
              </label>
            ))}
          </div>
        </section>
      </div>

      {erro && <p className="text-red-600 text-sm mt-3">{erro}</p>}
      <div className="flex gap-2 justify-end mt-4 border-t border-gray-100 pt-3">
        <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 text-sm">Cancelar</button>
        <button onClick={salvar} disabled={salvando} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm disabled:opacity-40">{salvando ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </Modal>
  );
}
