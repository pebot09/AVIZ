import { useEffect, useMemo, useState } from 'react';
import QRCodeLib from 'qrcode';
import { arr, sortTurmas, getTurmaLabel, TURMA_EXTRA_ID } from '../domain/helpers.js';
import { cap } from '../domain/vocab.js';
import Modal from './Modal.jsx';

// Link pessoal do aluno (?c=CÓDIGO). O código é a credencial — não há senha.
// Porte do GerarLinkModal do Passarinho; o QR é gerado localmente (o original
// chamava uma API externa, o que vazaria o link do aluno para terceiros).
export default function GerarLinkModal({ state, dispatch, vocab, tenantId, onClose }) {
  const [turmaId, setTurmaId] = useState('');
  const [alunoNome, setAlunoNome] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [verQR, setVerQR] = useState(false);

  const sorted = useMemo(() => sortTurmas(state.turmas), [state.turmas]);
  const turma = state.turmas.find((t) => t.id === turmaId);
  const alunos = turma ? [...arr(turma.alunos)].sort((a, b) => a.localeCompare(b, 'pt')) : [];
  const acesso = arr(state.acessos).find((a) => a.alunoNome === alunoNome && a.turmaId === turmaId);
  // O link leva escola E código: é assim que o servidor sabe onde procurar,
  // sem precisar de um índice global de códigos (que seria enumerável).
  const link = acesso
    ? `${window.location.origin}${window.location.pathname}?e=${encodeURIComponent(tenantId)}&c=${acesso.codigo}`
    : '';

  const copiar = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  };

  return (
    <Modal title={`Link do ${vocab.aluno}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{cap(vocab.turma)}</label>
          <select value={turmaId} onChange={(e) => { setTurmaId(e.target.value); setAlunoNome(''); setVerQR(false); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">
            <option value="">— Selecione —</option>
            {sorted.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id === TURMA_EXTRA_ID ? `${cap(vocab.alunos)} extras & ex-${vocab.alunos}` : getTurmaLabel(state.turmas, t.id)}
              </option>
            ))}
          </select>
        </div>

        {turmaId && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{cap(vocab.aluno)}</label>
            <select value={alunoNome} onChange={(e) => { setAlunoNome(e.target.value); setVerQR(false); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">
              <option value="">— Selecione —</option>
              {alunos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            {alunos.length === 0 && <p className="text-xs text-gray-400 mt-1">Nenhum {vocab.aluno} nesta {vocab.turma}.</p>}
          </div>
        )}

        {alunoNome && !acesso && (
          <button onClick={() => dispatch({ type: 'GERAR_ACESSO', alunoNome, turmaId })}
            className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
            Gerar link
          </button>
        )}

        {acesso && (
          <div className="space-y-2">
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 break-all">{link}</div>
            <button onClick={copiar}
              className={`w-full py-2 rounded-lg font-medium text-sm transition-colors ${copiado ? 'bg-green-600 text-white' : 'bg-gray-800 text-white hover:bg-gray-900'}`}>
              {copiado ? '✓ Copiado!' : '📋 Copiar link'}
            </button>
            <div className="flex gap-2">
              <button onClick={() => window.open(link, '_blank', 'noopener')}
                className="flex-1 py-2 rounded-lg font-medium text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">↗ Abrir</button>
              <button onClick={() => setVerQR((v) => !v)}
                className="flex-1 py-2 rounded-lg font-medium text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                {verQR ? '✕ Ocultar QR' : '▦ QR code'}
              </button>
            </div>
            {verQR && (
              <div className="flex flex-col items-center gap-1 pt-1">
                <QRCode texto={link} />
                <p className="text-xs text-gray-400 text-center">Peça para {alunoNome} escanear com a câmera.</p>
              </div>
            )}
            <p className="text-xs text-gray-400 text-center">Este link é permanente para {alunoNome}.</p>
            <button
              onClick={() => { if (confirm(`Revogar o link de ${alunoNome}? O link atual para de funcionar.`)) dispatch({ type: 'REVOGAR_ACESSO', id: acesso.id }); }}
              className="w-full text-xs text-red-400 hover:text-red-600 transition-colors pt-1">Revogar link</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// QR gerado no próprio navegador (lib empacotada). O original chamava uma API
// externa de QR, o que entregava o link — que é a credencial do aluno — a um
// terceiro em cada exibição.
function QRCode({ texto, size = 208 }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let vivo = true;
    QRCodeLib.toString(texto, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 })
      .then((s) => { if (vivo) setSvg(s); })
      .catch(() => { if (vivo) setSvg(''); });
    return () => { vivo = false; };
  }, [texto]);
  if (!svg) return <div style={{ width: size, height: size }} className="rounded-lg border border-gray-200 bg-gray-50" />;
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-lg border border-gray-200 bg-white p-1 [&>svg]:w-full [&>svg]:h-full"
      role="img" aria-label="QR code do link"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
