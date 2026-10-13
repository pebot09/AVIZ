import { useState } from 'react';
import { exportarDadosEscola, baixarJson, excluirEscola } from '../lib/dados.js';
import { nomeArquivoExportacao, confirmacaoExclusaoOk } from '../domain/dadosEscola.js';
import { LINK_TERMOS, LINK_PRIVACIDADE } from '../legal/rota.js';

// Configurações → Dados e privacidade. Só o dono vê (e as regras só deixam o
// dono apagar config, vitrine e equipe). Exportar e excluir são direitos da
// escola pela LGPD — ver PLANTA, seção 7.
export default function DadosSec({ tenant, uid, onDone }) {
  const [exportando, setExportando] = useState(false);
  const [resumo, setResumo] = useState(null);
  const [erroExp, setErroExp] = useState(null);

  const [abrirExclusao, setAbrirExclusao] = useState(false);
  const [digitado, setDigitado] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [erroExc, setErroExc] = useState(null);

  async function exportar() {
    setExportando(true); setErroExp(null);
    try {
      const agora = Date.now();
      const dados = await exportarDadosEscola(tenant, agora);
      baixarJson(dados, nomeArquivoExportacao(tenant, agora));
      setResumo(dados.resumo);
    } catch (e) {
      setErroExp('Não consegui gerar o arquivo. (' + (e.message || 'erro') + ')');
    } finally {
      setExportando(false);
    }
  }

  async function excluir() {
    if (!confirmacaoExclusaoOk(digitado, tenant)) return;
    setExcluindo(true); setErroExc(null);
    try {
      await excluirEscola(tenant, uid);
      window.location.href = '/';
    } catch (e) {
      setErroExc(e.message);
      setExcluindo(false);
    }
  }

  const podeExcluir = confirmacaoExclusaoOk(digitado, tenant) && !excluindo;

  return (
    <div className="space-y-5">
      <section>
        <h4 className="font-semibold text-gray-800 text-sm mb-1">Baixar os dados</h4>
        <p className="text-xs text-gray-500 mb-2">
          Um arquivo JSON com tudo o que a escola tem no AVIZ: turmas, alunos, faltas, reposições,
          férias, links de acesso, histórico, regras e equipe.
        </p>
        <button onClick={exportar} disabled={exportando} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm disabled:opacity-40">
          {exportando ? 'Gerando…' : 'Baixar dados (JSON)'}
        </button>
        {resumo && (
          <p className="text-xs text-green-700 mt-2">
            Arquivo gerado: {resumo.turmas} turma(s), {resumo.alunos} aluno(s), {resumo.faltas} falta(s), {resumo.reposicoes} reposição(ões).
          </p>
        )}
        {erroExp && <p className="text-red-600 text-sm mt-2">{erroExp}</p>}
      </section>

      <section className="border border-red-200 rounded-lg p-3 bg-red-50/40">
        <h4 className="font-semibold text-red-700 text-sm mb-1">Excluir a escola</h4>
        <p className="text-xs text-gray-600 mb-2">
          Apaga na hora e para sempre todas as turmas, alunos, histórico, fotos da lista e cópias de
          segurança, desativa todos os links de alunos e remove a equipe. Não dá para desfazer.
          Baixe os dados antes.
        </p>
        {!abrirExclusao ? (
          <button onClick={() => setAbrirExclusao(true)} className="px-4 py-2 border border-red-300 text-red-700 rounded-lg font-medium text-sm hover:bg-red-50">
            Excluir escola…
          </button>
        ) : (
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Para confirmar, digite o endereço da escola: <b className="font-mono">{tenant}</b>
            </label>
            <input
              value={digitado} onChange={(e) => setDigitado(e.target.value)} autoFocus
              className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm font-mono"
            />
            <div className="flex gap-2 justify-end mt-3">
              <button onClick={() => { setAbrirExclusao(false); setDigitado(''); setErroExc(null); }} disabled={excluindo} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 text-sm">Cancelar</button>
              <button onClick={excluir} disabled={!podeExcluir} className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium text-sm disabled:opacity-40">
                {excluindo ? 'Excluindo…' : 'Excluir para sempre'}
              </button>
            </div>
            {erroExc && <p className="text-red-600 text-sm mt-2">{erroExc}</p>}
          </div>
        )}
      </section>

      <p className="text-xs text-gray-400">
        Leia os <a href={LINK_TERMOS} target="_blank" rel="noreferrer" className="underline">Termos de Uso</a> e
        a <a href={LINK_PRIVACIDADE} target="_blank" rel="noreferrer" className="underline">Política de Privacidade</a>.
      </p>

      <div className="flex justify-end border-t border-gray-100 pt-3">
        <button onClick={onDone} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 text-sm">Voltar</button>
      </div>
    </div>
  );
}
