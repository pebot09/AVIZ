import { useState } from 'react';
import { exportarDadosEscola, baixarJson } from '../lib/dados.js';
import { nomeArquivoExportacao } from '../domain/dadosEscola.js';
import { LINK_TERMOS, LINK_PRIVACIDADE } from '../legal/rota.js';
import { mensagemDeErro } from '../lib/erros.js';

// Configurações → Baixar os dados. Só o dono vê. Exportar é direito da escola
// pela LGPD (PLANTA, seção 7). Excluir a escola saiu da tela, por decisão do
// Pedro: só a equipe do AVIZ exclui, a pedido do dono.
export default function DadosSec({ tenant, onDone }) {
  const [exportando, setExportando] = useState(false);
  const [resumo, setResumo] = useState(null);
  const [erroExp, setErroExp] = useState(null);

  async function exportar() {
    setExportando(true); setErroExp(null);
    try {
      const agora = Date.now();
      const dados = await exportarDadosEscola(tenant, agora);
      baixarJson(dados, nomeArquivoExportacao(tenant, agora));
      setResumo(dados.resumo);
    } catch (e) {
      setErroExp('Não consegui gerar o arquivo. (' + mensagemDeErro(e) + ')');
    } finally {
      setExportando(false);
    }
  }

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

      <p className="text-xs text-gray-500">
        Para excluir a escola e todos os dados dela, fale com a equipe do AVIZ.
      </p>

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
