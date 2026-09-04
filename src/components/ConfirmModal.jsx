import Modal from './Modal.jsx';

// Confirmação — portado do Passarinho.
export default function ConfirmModal({ title, message, onConfirm, onCancel, danger, confirmLabel = 'Confirmar', children }) {
  return (
    <Modal title={title} onClose={onCancel} danger={danger}>
      {message && <p className="text-gray-700 mb-4">{message}</p>}
      {children}
      <div className="flex gap-2 justify-end mt-4">
        <button onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancelar</button>
        <button onClick={onConfirm} className={`px-4 py-2 rounded-lg text-white font-medium ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
