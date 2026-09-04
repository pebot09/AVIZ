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
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full fade-in" onClick={(e) => e.stopPropagation()}>
        <div className={`p-4 border-b flex justify-between items-center rounded-t-xl ${danger ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-200'}`}>
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
