import { useState } from 'react';
import { enderecoDaEscola } from '../lib/escolaApi.js';

// O endereço é como o dono (e a equipe) volta ao espaço noutro aparelho.
export default function EnderecoGuardar({ slug, onFechar }) {
  const [copiado, setCopiado] = useState(false);
  const link = enderecoDaEscola(slug);
  const copiar = () => {
    try {
      navigator.clipboard.writeText(link).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); });
    } catch { /* sem clipboard: o endereço está na tela */ }
  };
  return (
    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
      <p className="text-blue-900 font-medium mb-1">Guarde o endereço do seu espaço</p>
      <p className="text-blue-800 break-all mb-2">{link}</p>
      <p className="text-xs text-blue-700 mb-2">É por ele que você e a equipe entram, em qualquer aparelho.</p>
      <button onClick={copiar} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${copiado ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
        {copiado ? '✓ Copiado!' : 'Copiar endereço'}
      </button>
      {onFechar && <button onClick={onFechar} className="ml-3 text-sm text-blue-700 underline">Entendi</button>}
    </div>
  );
}
