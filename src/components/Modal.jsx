import { useEffect } from 'react';

// Modal simples, no estilo do Passarinho (card branco centralizado).
export default function Modal({ title, children, onClose, danger }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      {/* Altura limitada à tela, com o título fixo e só o conteúdo rolando:
          sem isso, um conteúdo maior que a tela do celular ficava cortado. */}
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full fade-in flex flex-col max-h-[calc(100dvh-2rem)]" onClick={(e) => e.stopPropagation()}>
        <div className={`p-4 border-b flex justify-between items-center rounded-t-xl shrink-0 ${danger ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-200'}`}>
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-4 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
