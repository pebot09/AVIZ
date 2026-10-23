import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../lib/firebase.js';
import { paths } from '../lib/paths.js';
import { salvarProfessor, removerProfessor } from '../lib/professorApi.js';
import { definirMeuPin } from '../lib/contaApi.js';
import { problemaDoPinConta, emailValido, PIN_CONTA_TAMANHO } from '../domain/conta.js';
import { makeVocab, cap } from '../domain/vocab.js';
import ConfirmModal from './ConfirmModal.jsx';
import { mensagemDeErro } from '../lib/erros.js';

// Configurações → Equipe (só o dono). Todo mundo entra com e-mail + PIN de 4
// números: o dono troca o próprio PIN e cadastra cada professor com nome,
// e-mail e PIN. O PIN nunca volta para a tela: o servidor guarda só o hash,
// então "trocar PIN" é definir um novo.
export default function EquipeSec({ tenant, config, onDone }) {
  const [membros, setMembros] = useState(undefined);
  useEffect(() => onValue(ref(db, paths.members(tenant)), (snap) => setMembros(snap.val() || {}), () => setMembros({})), [tenant]);

  const professores = Object.entries(membros || {})
    .filter(([, m]) => m && m.role === 'professor')
    .map(([id, m]) => ({ id, nome: m.nome, email: m.email || '' }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <EquipeView
      vocab={makeVocab(config)} professores={professores} carregando={membros === undefined}
      salvarMeuPin={(pin) => definirMeuPin(pin)}
      salvar={(dados) => salvarProfessor(tenant, dados)} remover={(id) => removerProfessor(tenant, id)} onDone={onDone}
    />
  );
}

// Parte visual, separada para o teste de render.
export function EquipeView({ vocab, professores, carregando, salvarMeuPin, salvar, remover, onDone }) {
  const [editando, setEditando] = useState(null); // null | { proprio } | { id?, nome, email }
  const [removendo, setRemovendo] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const link = typeof window !== 'undefined' ? window.location.origin : '';

  if (editando) {
    const salvarForm = editando.proprio ? ({ pin }) => salvarMeuPin(pin) : salvar;
    return (
      <FormProfessor
        inicial={editando} vocab={vocab} salvar={salvarForm}
        onFim={(r) => { setEditando(null); setAviso((r && r.aviso) || null); }}
      />
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-600 mb-3">
        A equipe entra em <span className="font-medium break-all">{link}</span> com o próprio e-mail e o PIN de {PIN_CONTA_TAMANHO} números.
      </p>
      <div className="flex items-center justify-between rounded-lg px-3 py-2.5 mb-4 border border-gray-200">
        <span className="text-sm text-gray-800">
          <span className="font-medium">Seu PIN</span>
          <span className="block text-xs text-gray-500">Você entra com seu e-mail e este PIN, em qualquer aparelho.</span>
        </span>
        <button onClick={() => setEditando({ proprio: true })} className="text-xs text-blue-600 hover:text-blue-800 shrink-0 ml-3">trocar meu PIN</button>
      </div>
      <p className="text-sm font-medium text-gray-700 mb-2">{cap(vocab.professores)}</p>
      {carregando ? (
        <p className="text-sm text-gray-400 py-3">Carregando…</p>
      ) : professores.length === 0 ? (
        <p className="text-sm text-gray-400 py-3">Nenhum {vocab.professor} cadastrado ainda.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg mb-3">
          {professores.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-3 py-2 gap-3">
              <span className="text-sm text-gray-800 min-w-0">
                {p.nome}
                <span className={`block text-xs break-all ${p.email ? 'text-gray-400' : 'text-amber-600'}`}>
                  {p.email || 'sem e-mail: edite para ele conseguir entrar'}
                </span>
              </span>
              <span className="flex gap-3 text-xs shrink-0">
                <button onClick={() => setEditando(p)} className="text-blue-600 hover:text-blue-800">editar</button>
                <button onClick={() => setRemovendo(p)} className="text-red-500 hover:text-red-700">remover</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {aviso && <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 text-sm mt-2">{aviso}</p>}
      {erro && <p className="text-red-600 text-sm mt-2">{erro}</p>}
      <div className="flex gap-2 justify-end mt-4 border-t border-gray-100 pt-3">
        <button onClick={onDone} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 text-sm">Voltar</button>
        <button onClick={() => setEditando({ nome: '', email: '' })} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm">Adicionar {vocab.professor}</button>
      </div>
      {removendo && (
        <ConfirmModal
          title={`Remover ${removendo.nome}?`} danger confirmLabel="Remover"
          message={`${removendo.nome} perde o acesso na hora, inclusive se estiver com o app aberto. O histórico continua com o nome.`}
          onCancel={() => setRemovendo(null)}
          onConfirm={async () => {
            const p = removendo; setRemovendo(null); setErro(null);
            try { await remover(p.id); } catch (e) { setErro(mensagemDeErro(e)); }
          }}
        />
      )}
    </div>
  );
}

const campo = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm';
const rotulo = 'block text-sm font-medium text-gray-600 mb-1.5';

function FormProfessor({ inicial, vocab, salvar, onFim }) {
  const proprio = !!inicial.proprio;
  const novo = !inicial.id;
  const emailFixo = !!inicial.email; // depois de definido, o e-mail não muda
  const [nome, setNome] = useState(inicial.nome || '');
  const [email, setEmail] = useState(inicial.email || '');
  const [pin, setPin] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const pinObrigatorio = proprio || novo;

  async function enviar(e) {
    e.preventDefault();
    setErro(null);
    if (!proprio && !nome.trim()) { setErro('Informe o nome.'); return; }
    if (!proprio && !emailValido(email)) { setErro('Informe um e-mail válido.'); return; }
    if (pinObrigatorio || pin) {
      const problema = problemaDoPinConta(pin);
      if (problema) { setErro(problema); return; }
    }
    setSalvando(true);
    try {
      const r = await salvar({ id: inicial.id, nome: nome.trim(), email: emailFixo ? undefined : email, pin: pin || undefined });
      onFim(r);
    } catch (err) { setErro(mensagemDeErro(err)); setSalvando(false); }
  }

  return (
    <form onSubmit={enviar}>
      <p className="text-sm font-medium text-gray-700 mb-3">{proprio ? 'Seu PIN' : novo ? `Novo ${vocab.professor}` : `Editar ${inicial.nome}`}</p>
      {!proprio && (
        <>
          <label className={rotulo}>Nome (aparece no histórico)</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} autoFocus className={`${campo} mb-4`} />
          <label className={rotulo}>E-mail (é com ele que {vocab.professor === 'professor' ? 'o professor' : `o ${vocab.professor}`} entra)</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={emailFixo}
            placeholder="nome@email.com" className={`${campo} mb-4 disabled:bg-gray-50 disabled:text-gray-500`}
          />
        </>
      )}
      <label className={rotulo}>
        {pinObrigatorio ? `PIN de ${PIN_CONTA_TAMANHO} números` : 'Novo PIN (deixe vazio para manter o atual)'}
      </label>
      <input
        value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_CONTA_TAMANHO))}
        type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password" placeholder={'•'.repeat(PIN_CONTA_TAMANHO)}
        className={`${campo} tracking-[0.4em]`}
      />
      <p className="text-xs text-gray-400 mt-1.5">{proprio
        ? 'Guarde bem: ele dá acesso de responsável. Se esquecer, use "Esqueci meu PIN" na tela de entrada.'
        : 'Passe o PIN pessoalmente. Depois de salvo, ele não aparece mais aqui.'}</p>
      {erro && <p className="text-red-600 text-sm mt-2">{erro}</p>}
      <div className="flex gap-2 justify-end mt-4 border-t border-gray-100 pt-3">
        <button type="button" onClick={() => onFim(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 text-sm">Cancelar</button>
        <button type="submit" disabled={salvando} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm disabled:opacity-40">{salvando ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </form>
  );
}
