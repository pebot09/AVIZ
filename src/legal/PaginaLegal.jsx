import { TERMOS } from './termos.js';
import { PRIVACIDADE } from './privacidade.js';
import { VERSAO_TEXTOS, textosProntos } from './operador.js';
import { LINK_TERMOS, LINK_PRIVACIDADE } from './rota.js';

const DOCS = { termos: TERMOS, privacidade: PRIVACIDADE };

// Página pública dos Termos de Uso ou da Política de Privacidade.
export default function PaginaLegal({ qual }) {
  const doc = DOCS[qual] || TERMOS;
  const outro = qual === 'privacidade'
    ? { href: LINK_TERMOS, label: 'Termos de Uso' }
    : { href: LINK_PRIVACIDADE, label: 'Política de Privacidade' };

  return (
    <main className="min-h-screen bg-gray-100 py-8 px-4">
      <article className="bg-white rounded-2xl shadow-sm border border-gray-200 p-7 max-w-2xl mx-auto">
        <div className="text-[10px] tracking-[0.2em] text-gray-300 font-semibold mb-5">AVIZ</div>
        <h1 className="text-2xl font-bold text-gray-800">{doc.titulo}</h1>
        <p className="text-xs text-gray-400 mt-1">Versão {VERSAO_TEXTOS}</p>

        {!textosProntos() && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-sm mt-4">
            <b>Rascunho.</b> Este texto ainda está em revisão jurídica e pode mudar antes de valer.
          </div>
        )}

        {doc.secoes.map((sec) => (
          <section key={sec.titulo} className="mt-6">
            <h2 className="font-semibold text-gray-800 mb-2">{sec.titulo}</h2>
            {sec.blocos.map((b, i) => (typeof b === 'string' ? (
              <p key={i} className="text-sm text-gray-600 leading-relaxed mb-2">{b}</p>
            ) : (
              <ul key={i} className="list-disc pl-5 text-sm text-gray-600 leading-relaxed mb-2 space-y-1">
                {b.lista.map((item) => <li key={item}>{item}</li>)}
              </ul>
            )))}
          </section>
        ))}

        <div className="flex justify-between border-t border-gray-100 mt-8 pt-4 text-sm">
          <a href="/" className="text-gray-500 hover:text-gray-700">← Voltar ao AVIZ</a>
          <a href={outro.href} className="text-blue-600 hover:text-blue-800">{outro.label}</a>
        </div>
      </article>
    </main>
  );
}
