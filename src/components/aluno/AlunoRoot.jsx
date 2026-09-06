import { useCallback, useEffect, useState } from 'react';
import { buscarFatia, enviarAcao } from '../../lib/alunoApi.js';
import { makeVocab } from '../../domain/vocab.js';
import AlunoApp from './AlunoApp.jsx';

// Carrega a fatia do aluno e envia as ações dele. Toda a decisão de "o que ele
// pode ver e fazer" é do servidor; aqui só transportamos.
export default function AlunoRoot({ tenant, codigo }) {
  const [dados, setDados] = useState(undefined); // undefined = carregando
  const [erroCarga, setErroCarga] = useState(null);
  const [erroAcao, setErroAcao] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setErroCarga(null);
      setDados(await buscarFatia(tenant, codigo));
    } catch (e) {
      setErroCarga(e.message);
      setDados(null);
    }
  }, [tenant, codigo]);

  useEffect(() => { carregar(); }, [carregar]);

  // Devolve true quando a ação foi aplicada, para a tela saber se limpa o
  // formulário e mostra o "pronto".
  const executar = async (acao) => {
    setOcupado(true);
    setErroAcao(null);
    try {
      setDados(await enviarAcao(tenant, codigo, acao));
      return true;
    } catch (e) {
      setErroAcao(e.message);
      // Conflito: alguém mexeu na escola no meio. Recarrega para o aluno ver o
      // estado real antes de tentar de novo.
      if (e.tipo === 'conflito') carregar();
      return false;
    } finally {
      setOcupado(false);
    }
  };

  if (dados === undefined) return <Aviso>Carregando…</Aviso>;

  if (!dados) {
    return (
      <Aviso titulo="Não deu para abrir">
        {erroCarga}
        <button onClick={carregar} className="mt-4 w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold">Tentar de novo</button>
      </Aviso>
    );
  }

  return (
    <AlunoApp
      fatia={dados.fatia}
      config={dados.config}
      vocab={makeVocab(dados.config)}
      nomeEscola={dados.escola?.nome || tenant}
      executar={executar}
      ocupado={ocupado}
      erro={erroAcao}
    />
  );
}

function Aviso({ titulo, children }) {
  return (
    <main className="min-h-screen bg-amber-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm p-6 max-w-sm w-full">
        <div className="text-[10px] tracking-[0.2em] text-gray-300 font-semibold mb-4">AVIZ</div>
        {titulo && <h2 className="text-lg font-bold text-gray-800 mb-2">{titulo}</h2>}
        <div className="text-sm text-gray-600">{children}</div>
      </div>
    </main>
  );
}
