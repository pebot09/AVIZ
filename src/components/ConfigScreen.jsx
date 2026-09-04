import { useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import { saveConfig, saveTenantPublic } from '../lib/store.js';
import { feriadosNacionais } from '../domain/calendario.js';
import { fmtBRFull, arr } from '../domain/helpers.js';
import { Campo, TextInput, NumberSelect, Select, SimNao, ArtigoNome } from '../onboarding/widgets.jsx';

// Configurações do dono — menu de seções. Calendário é uma delas, entre as outras.
export default function ConfigScreen({ tenant, config, pub, dispatch, onClose }) {
  const [sec, setSec] = useState(null);
  const secoes = [
    { key: 'identidade', label: 'Identidade', desc: 'Nome e cor da escola', comp: IdentidadeSec },
    { key: 'vocab', label: 'Vocabulário', desc: 'Como chamar aluno, turma, professor', comp: VocabSec },
    { key: 'capacidades', label: 'Capacidades', desc: 'Máximo por turma e na sala', comp: CapacidadesSec },
    { key: 'faltas', label: 'Faltas', desc: 'Antecedência e validade', comp: FaltasSec },
    { key: 'vagaextra', label: 'Vaga extra', desc: 'Abertura de vagas de reposição', comp: VagaExtraSec },
    { key: 'ferias', label: 'Férias', desc: 'Créditos e limites', comp: FeriasSec },
    { key: 'calendario', label: 'Calendário', desc: 'Recessos e feriados', comp: CalendarioSec },
  ];
  const atual = secoes.find((s) => s.key === sec);

  return (
    <Modal title={atual ? `Configurações — ${atual.label}` : 'Configurações'} onClose={onClose}>
      {!atual ? (
        <div className="divide-y divide-gray-100 -my-1">
          {secoes.map((s) => (
            <button key={s.key} onClick={() => setSec(s.key)} className="w-full text-left py-3 flex items-center justify-between hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors">
              <span>
                <span className="block text-sm font-medium text-gray-800">{s.label}</span>
                <span className="block text-xs text-gray-400">{s.desc}</span>
              </span>
              <span className="text-gray-300 text-lg">›</span>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <button onClick={() => setSec(null)} className="text-sm text-blue-600 hover:text-blue-800 mb-3">← Voltar</button>
          <atual.comp tenant={tenant} config={config} pub={pub} dispatch={dispatch} onDone={() => setSec(null)} />
        </div>
      )}
    </Modal>
  );
}

// Barra de ações padrão de cada seção.
function Acoes({ onSalvar, salvando, erro, onCancel }) {
  return (
    <>
      {erro && <p className="text-red-600 text-sm mt-2">{erro}</p>}
      <div className="flex gap-2 justify-end mt-4 border-t border-gray-100 pt-3">
        <button onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 text-sm">Voltar</button>
        <button onClick={onSalvar} disabled={salvando} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm disabled:opacity-40">{salvando ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </>
  );
}

// Hook simples de salvamento.
function useSalvar(fn, onDone) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  async function salvar() {
    setSalvando(true); setErro(null);
    try { await fn(); onDone(); } catch (e) { setErro(e.message); } finally { setSalvando(false); }
  }
  return { salvar, salvando, erro };
}

function mergeRegras(config, changes) { return { regras: { ...(config?.regras || {}), ...changes } }; }

// ---- Seções ----

function IdentidadeSec({ tenant, pub, onDone }) {
  const [nome, setNome] = useState(pub?.nome || '');
  const [artigo, setArtigo] = useState(pub?.artigo || 'o');
  const [cor, setCor] = useState(pub?.cor || '#2563eb');
  const { salvar, salvando, erro } = useSalvar(() => saveTenantPublic(tenant, { nome: nome.trim() || (pub?.nome || ''), artigo, cor }), onDone);
  return (
    <div>
      <Campo label="Nome do espaço (e artigo)">
        <ArtigoNome artigo={artigo} nome={nome} onArtigo={setArtigo} onNome={setNome} placeholder="Nome do espaço" />
      </Campo>
      <Campo label="Cor de destaque">
        <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="h-9 w-16 rounded border border-gray-300" />
      </Campo>
      <Acoes onSalvar={salvar} salvando={salvando} erro={erro} onCancel={onDone} />
    </div>
  );
}

function VocabSec({ tenant, config, onDone }) {
  const v = config?.vocab || {};
  const [f, setF] = useState({ aluno: v.aluno || 'aluno', alunos: v.alunos || 'alunos', turma: v.turma || 'turma', turmas: v.turmas || 'turmas', professor: v.professor || 'professor', professores: v.professores || 'professores' });
  const set = (k) => (val) => setF((p) => ({ ...p, [k]: val }));
  const { salvar, salvando, erro } = useSalvar(() => saveConfig(tenant, { vocab: { ...v, ...f } }), onDone);
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Singular"><TextInput value={f.aluno} onChange={set('aluno')} /></Campo>
        <Campo label="Plural"><TextInput value={f.alunos} onChange={set('alunos')} /></Campo>
        <Campo label="Turma (sing.)"><TextInput value={f.turma} onChange={set('turma')} /></Campo>
        <Campo label="Turma (plural)"><TextInput value={f.turmas} onChange={set('turmas')} /></Campo>
        <Campo label="Professor (sing.)"><TextInput value={f.professor} onChange={set('professor')} /></Campo>
        <Campo label="Professor (plural)"><TextInput value={f.professores} onChange={set('professores')} /></Campo>
      </div>
      <Acoes onSalvar={salvar} salvando={salvando} erro={erro} onCancel={onDone} />
    </div>
  );
}

function CapacidadesSec({ tenant, config, onDone }) {
  const r = config?.regras || {};
  const [nominal, setNominal] = useState(r.capacidadeNominal || 7);
  const [fisica, setFisica] = useState(r.capacidadeFisica || 8);
  const { salvar, salvando, erro } = useSalvar(() => saveConfig(tenant, mergeRegras(config, { capacidadeNominal: Number(nominal) || 7, capacidadeFisica: Number(fisica) || 8 })), onDone);
  return (
    <div>
      <Campo label="Máximo por turma (nominal)"><input type="number" min="1" value={nominal} onChange={(e) => setNominal(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28" /></Campo>
      <Campo label="Máximo na sala (físico)"><input type="number" min="1" value={fisica} onChange={(e) => setFisica(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28" /></Campo>
      <Acoes onSalvar={salvar} salvando={salvando} erro={erro} onCancel={onDone} />
    </div>
  );
}

const HORAS_ANTEC = [{ value: 0, label: 'Sem exigência' }, { value: 1, label: '1 hora' }, { value: 2, label: '2 horas' }, { value: 3, label: '3 horas' }, { value: 6, label: '6 horas' }, { value: 12, label: '12 horas' }, { value: 24, label: '24 horas' }, { value: 48, label: '48 horas' }];

function FaltasSec({ tenant, config, onDone }) {
  const r = config?.regras || {};
  const [antec, setAntec] = useState(r.antecedenciaHoras ?? 24);
  const [semA, setSemA] = useState(!!r.semAntecedencia);
  const [janela, setJanela] = useState(r.semAntecedenciaJanela || 2);
  const [validade, setValidade] = useState(r.validadeFaltaDias ?? 30);
  const { salvar, salvando, erro } = useSalvar(() => saveConfig(tenant, mergeRegras(config, {
    antecedenciaHoras: Number(antec) || 0,
    semAntecedencia: antec > 0 ? semA : false,
    semAntecedenciaJanela: antec > 0 && semA ? Number(janela) || 2 : 0,
    validadeFaltaDias: Number(validade) || 0,
  })), onDone);
  return (
    <div>
      <Campo label="Antecedência mínima para avisar"><NumberSelect value={antec} onChange={setAntec} options={HORAS_ANTEC} /></Campo>
      {antec > 0 && (
        <Campo label="Permitir falta sem antecedência?"><SimNao value={semA} onChange={setSemA} /></Campo>
      )}
      {antec > 0 && semA && (
        <Campo label="Até quantas horas antes ainda vale (sem antecedência)"><NumberSelect value={janela} onChange={setJanela} options={Array.from({ length: antec }, (_, k) => ({ value: k + 1, label: `${k + 1}h` }))} /></Campo>
      )}
      <Campo label="Validade da falta"><NumberSelect value={validade} onChange={setValidade} options={[{ value: 30, label: '30 dias' }, { value: 45, label: '45 dias' }, { value: 60, label: '60 dias' }, { value: 90, label: '90 dias' }, { value: 0, label: 'Não expira' }]} /></Campo>
      <Acoes onSalvar={salvar} salvando={salvando} erro={erro} onCancel={onDone} />
    </div>
  );
}

function VagaExtraSec({ tenant, config, onDone }) {
  const r = config?.regras || {};
  const [on, setOn] = useState(!!r.vagaExtra);
  const [abertura, setAbertura] = useState(r.vagaExtraAbertura || 'vespera');
  const { salvar, salvando, erro } = useSalvar(() => saveConfig(tenant, mergeRegras(config, { vagaExtra: on, vagaExtraAbertura: on ? abertura : null })), onDone);
  return (
    <div>
      <Campo label="Liberar vaga extra?"><SimNao value={on} onChange={setOn} /></Campo>
      {on && (
        <Campo label="Quando a vaga extra abre"><Select value={abertura} onChange={setAbertura} options={[{ value: 'vespera', label: 'Na véspera' }, { value: '6h', label: '6 horas antes' }, { value: '12h', label: '12 horas antes' }, { value: '2d', label: '2 dias antes' }, { value: '3d', label: '3 dias antes' }]} /></Campo>
      )}
      <Acoes onSalvar={salvar} salvando={salvando} erro={erro} onCancel={onDone} />
    </div>
  );
}

function FeriasSec({ tenant, config, onDone }) {
  const r = config?.regras || {};
  const [oferece, setOferece] = useState(!!r.ferias);
  const [credito, setCredito] = useState(!!r.feriasCredito);
  const [qtd, setQtd] = useState(r.feriasCreditos || 1);
  const [validade, setValidade] = useState(r.feriasValidadeDias || 30);
  const [limite, setLimite] = useState(r.feriasLimiteAno ?? 1);
  const { salvar, salvando, erro } = useSalvar(() => saveConfig(tenant, mergeRegras(config, {
    ferias: oferece,
    feriasCredito: oferece ? credito : false,
    feriasCreditos: oferece && credito ? Number(qtd) || 1 : 0,
    feriasValidadeDias: oferece && credito ? Number(validade) || 30 : 0,
    feriasLimiteAno: oferece && credito ? limite : null,
  })), onDone);
  return (
    <div>
      <Campo label="Oferece marcação de férias?"><SimNao value={oferece} onChange={setOferece} /></Campo>
      {oferece && <Campo label="Férias dão crédito de reposição?"><SimNao value={credito} onChange={setCredito} /></Campo>}
      {oferece && credito && (
        <>
          <Campo label="Quantos créditos por período"><NumberSelect value={qtd} onChange={setQtd} options={[1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))} /></Campo>
          <Campo label="Validade do crédito"><NumberSelect value={validade} onChange={setValidade} options={[30, 45, 60, 90].map((n) => ({ value: n, label: `${n} dias` }))} /></Campo>
          <Campo label="Limite por ano"><NumberSelect value={limite} onChange={setLimite} options={[{ value: 1, label: '1 vez' }, { value: 2, label: '2 vezes' }, { value: 0, label: 'Sem limite' }]} /></Campo>
        </>
      )}
      <Acoes onSalvar={salvar} salvando={salvando} erro={erro} onCancel={onDone} />
    </div>
  );
}

function CalendarioSec({ tenant, config, dispatch, onDone }) {
  const cal = config?.calendario || {};
  const [recessos, setRecessos] = useState(arr(cal.recessos));
  const [municipais, setMunicipais] = useState(arr(cal.feriadosMunicipais));
  const [ignorados, setIgnorados] = useState(new Set(arr(cal.feriadosIgnorados)));
  const anoAtual = new Date().getFullYear();
  const nacionais = useMemo(() => {
    const juntos = { ...feriadosNacionais(anoAtual), ...feriadosNacionais(anoAtual + 1) };
    return Object.entries(juntos).sort((a, b) => a[0].localeCompare(b[0]));
  }, [anoAtual]);

  const setRecesso = (i, patch) => setRecessos((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setMunicipal = (i, patch) => setMunicipais((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const toggleIgnorado = (data) => setIgnorados((s) => { const n = new Set(s); n.has(data) ? n.delete(data) : n.add(data); return n; });

  const { salvar, salvando, erro } = useSalvar(async () => {
    const calendario = {
      recessos: recessos.filter((r) => r.de && r.ate).map((r) => ({ de: r.de, ate: r.ate, nome: (r.nome || 'Recesso').trim() })),
      feriadosMunicipais: municipais.filter((m) => m.data).map((m) => ({ data: m.data, nome: (m.nome || 'Feriado').trim() })),
      feriadosIgnorados: [...ignorados],
    };
    await saveConfig(tenant, { calendario });
    dispatch({ type: 'CLEANUP' });
  }, onDone);

  return (
    <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
      <section>
        <h4 className="font-semibold text-gray-800 text-sm mb-1">Recessos</h4>
        <p className="text-xs text-gray-500 mb-2">Períodos sem aula. Meses tocados por um recesso não geram crédito de férias.</p>
        <div className="space-y-2">
          {recessos.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 bg-gray-50 rounded-lg p-2">
              <input type="date" value={r.de || ''} onChange={(e) => setRecesso(i, { de: e.target.value })} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              <span className="text-gray-400 text-xs">até</span>
              <input type="date" value={r.ate || ''} onChange={(e) => setRecesso(i, { ate: e.target.value })} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              <input value={r.nome || ''} onChange={(e) => setRecesso(i, { nome: e.target.value })} placeholder="Nome" className="flex-1 min-w-[7rem] border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              <button onClick={() => setRecessos((rs) => rs.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs px-1">remover</button>
            </div>
          ))}
        </div>
        <button onClick={() => setRecessos((rs) => [...rs, { de: '', ate: '', nome: '' }])} className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium">+ Adicionar recesso</button>
      </section>

      <section>
        <h4 className="font-semibold text-gray-800 text-sm mb-1">Feriados municipais</h4>
        <p className="text-xs text-gray-500 mb-2">Os nacionais já são reconhecidos automaticamente.</p>
        <div className="space-y-2">
          {municipais.map((m, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 bg-gray-50 rounded-lg p-2">
              <input type="date" value={m.data || ''} onChange={(e) => setMunicipal(i, { data: e.target.value })} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              <input value={m.nome || ''} onChange={(e) => setMunicipal(i, { nome: e.target.value })} placeholder="Nome do feriado" className="flex-1 min-w-[7rem] border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              <button onClick={() => setMunicipais((ms) => ms.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs px-1">remover</button>
            </div>
          ))}
        </div>
        <button onClick={() => setMunicipais((ms) => [...ms, { data: '', nome: '' }])} className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium">+ Adicionar feriado</button>
      </section>

      <section>
        <h4 className="font-semibold text-gray-800 text-sm mb-1">Feriados nacionais</h4>
        <p className="text-xs text-gray-500 mb-2">Desmarque um feriado se a escola funciona normalmente nele.</p>
        <div className="space-y-1">
          {nacionais.map(([data, nome]) => (
            <label key={data} className="flex items-center gap-2 text-sm py-1">
              <input type="checkbox" checked={!ignorados.has(data)} onChange={() => toggleIgnorado(data)} className="rounded" />
              <span className={ignorados.has(data) ? 'text-gray-400 line-through' : 'text-gray-700'}>{fmtBRFull(data)} — {nome}</span>
            </label>
          ))}
        </div>
      </section>

      <Acoes onSalvar={salvar} salvando={salvando} erro={erro} onCancel={onDone} />
    </div>
  );
}
