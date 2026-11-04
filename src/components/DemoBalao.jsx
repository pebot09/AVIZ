import { useEffect, useRef, useState } from 'react';
import { aoBloquear, MSG_DEMO } from '../lib/demo.js';

// Balão "Versão de demonstração", perto de onde a pessoa tocou. Some sozinho.
export default function DemoBalao() {
  const [balao, setBalao] = useState(null); // { x, y, n }
  const ultimoToque = useRef(null);

  useEffect(() => {
    const guardar = (e) => { ultimoToque.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('pointerdown', guardar, true);
    let timer;
    const tirar = aoBloquear(() => {
      const p = ultimoToque.current || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      setBalao({ ...p, n: Date.now() });
      clearTimeout(timer);
      timer = setTimeout(() => setBalao(null), 1800);
    });
    return () => { window.removeEventListener('pointerdown', guardar, true); tirar(); clearTimeout(timer); };
  }, []);

  if (!balao) return null;
  // Fica acima do toque e dentro da tela (largura ~210px).
  const largura = 210;
  const vw = window.innerWidth;
  const left = Math.min(Math.max(balao.x - largura / 2, 8), vw - largura - 8);
  const top = Math.max(balao.y - 52, 8);
  const seta = Math.min(Math.max(balao.x - left, 14), largura - 14);
  return (
    <div
      key={balao.n} role="status" aria-live="polite"
      style={{ position: 'fixed', left, top, width: largura, zIndex: 1000, pointerEvents: 'none' }}
      className="bg-gray-900 text-white text-sm font-medium text-center rounded-lg px-3 py-2 shadow-lg"
    >
      {MSG_DEMO}
      <span style={{ position: 'absolute', left: seta - 6, bottom: -6, width: 12, height: 12, transform: 'rotate(45deg)' }} className="bg-gray-900" />
    </div>
  );
}

// Faixa discreta no topo, para ninguém confundir com uma escola de verdade.
export function DemoFaixa() {
  return (
    <div className="bg-amber-100 text-amber-800 text-xs text-center py-1.5 px-3 font-medium">
      Versão de demonstração · navegue à vontade, nada é gravado
    </div>
  );
}
