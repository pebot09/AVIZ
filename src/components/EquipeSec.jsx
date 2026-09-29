import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../lib/firebase.js';
import { paths } from '../lib/paths.js';
import { salvarProfessor, removerProfessor } from '../lib/professorApi.js';
import { problemaDoPin, PIN_TAMANHO } from '../domain/pin.js';
import { makeVocab } from '../domain/vocab.js';
import ConfirmModal from './ConfirmModal.jsx';

// Configurações → Equipe (só o dono). Cada professor entra com o próprio PIN,
// que o dono define aqui. O PIN nunca volta para a tela: o servidor guarda só
// o hash, então "trocar PIN" é definir um novo.
export default function EquipeSec({ tenant, config, onDone }) {
  const [membros, setMembros] = useState(undefined);
  useEffect(() => onValue(ref(db, paths.members(tenant)), (snap) => setMembros(snap.val() || {}), () => setMembros({})), [tenant]);

  const professores = Object.entries(membros || {})
    .filter(([, m]) => m && m.role === 'professor')
    .map(([id, m]) => ({ id, nome: m.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <EquipeView
      tenant={tenant} vocab={makeVocab(config)} professores={professores} carregando={membros === undefined}
      salvar={(dados) => salvarProfessor(tenant, dados)} remover={(id) => removerProfessor(tenant, id)} onDone={onDone}
    />
  );
}

// Parte visual, separada para o teste de render.
export function EquipeView({ tenant, vocab, professores, carregando, salvar, remover, onDone }) {
  const [editando, setEditando] = useState(null); // null | { id?, nome }
  const [removendo, setRemovendo] = useState(null);
  const [erro, setErro] = useState(null);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/?e=${tenant}` : `/?e=${tenant}`;

  if (editando) {
    return <FormProfessor inicial={editando} vocab={vocab} salvar={salvar} onFim={() => setEditando(null)} />;
  }

  return (
    <div>
      <p className="text-sm text-gray-600 mb-3">
        Cada {vocab.professor} entra em <span className="font-medium break-all">{link}</span> escolhendo o próprio nome e digitando o PIN que você definir aqui.
      </p>
      {carregando ? (
        <p className="text-sm text-gray-400 py-3">Carregando…</p>
      ) : professores.length === 0 ? (
        <p className="text-sm text-gray-400 py-3">Nenhum {vocab.professor} cadastrado ainda.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg mb-3">
          {professores.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-3 py-2">
              <span className="text-sm text-gray-800">{p.nome}</span>
              <span className="flex gap-3 text-xs">
                <button onClick={() => setEditando(p)} className="text-blue-600 hover:text-blue-800">editar / trocar PIN</button>
                <button onClick={() => setRemovendo(p)} className="text-red-500 hover:text-red-700">remover</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {erro && <p className="text-red-600 text-sm mt-2">{erro}</p>}
      <div className="flex gap-2 justify-end mt-4 border-t border-gray-100 pt-3">
        <button onClick={onDone} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 text-sm">Voltar</button>
        <button onClick={() => setEditando({ nome: '' })} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm">Adicionar {vocab.professor}</button>
      </div>
      {removendo && (
        <ConfirmModal
          title={`Remover ${removendo.nome}?`} danger confirmLabel="Remover"
          message={`${removendo.nome} perde o acesso na hora, inclusive se estiver com o app aberto. O histórico continua com o nome.`}
          onCancel={() => setRemovendo(null)}
          onConfirm={async () => {
            const p = removendo; setRemovendo(null); setErro(null);
            try { await remover(p.id); } catch (e) { setErro(e.message); }
          }}
        />
      )}
    </div>
  );
}

function FormProfessor({ inicial, vocab, salvar, onFim }) {
  const novo = !inicial.id;
  const [nome, setNome] = useState(inicial.nome || '');
  const [pin, setPin] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  async function enviar(e) {
    e.preventDefault();
    setErro(null);
    if (!nome.trim()) { setErro('Informe o nome.'); return; }
    if (novo || pin) {
      const problema = problemaDoPin(pin);
      if (problema) { setErro(problema); return; }
    }
    setSalvando(true);
    try { await salvar({ id: inicial.id, nome: nome.trim(), pin: pin || undefined }); onFim(); }
    catch (err) { setErro(err.message); }
    finally { setSalvando(false); }
  }

  return (
    <form onSubmit={enviar}>
      <p className="text-sm font-medium text-gray-700 mb-3">{novo ? `Novo ${vocab.professor}` : `Editar ${inicial.nome}`}</p>
      <label className="block text-sm font-medium text-gray-600 mb-1.5">Nome (aparece no histórico)</label>
      <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} autoFocus className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-4" />
      <label className="block text-sm font-medium text-gray-600 mb-1.5">
        {novo ? `PIN de ${PIN_TAMANHO} números` : `Novo PIN (deixe vazio para manter o atual)`}
      </label>
      <input
        value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_TAMANHO))}
        inputMode="numeric" autoComplete="off" placeholder={'•'.repeat(PIN_TAMANHO)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm tracking-[0.4em]"
      />
      <p className="text-xs text-gray-400 mt-1.5">Passe o PIN pessoalmente. Depois de salvo, ele não aparece mais aqui.</p>
      {erro && <p className="text-red-600 text-sm mt-2">{erro}</p>}
      <div className="flex gap-2 justify-end mt-4 border-t border-gray-100 pt-3">
        <button type="button" onClick={onFim} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 text-sm">Cancelar</button>
        <button type="submit" disabled={salvando} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm disabled:opacity-40">{salvando ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </form>
  );
}
