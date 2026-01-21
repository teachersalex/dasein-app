/*
 * ConfirmModal.jsx — Modal de confirmação global
 * 
 * Usado em: Post.jsx, Profile.jsx, Admin.jsx
 * CSS: usa classes do index.css (.confirm-modal, .confirm-sheet, etc)
 */

export default function ConfirmModal({ message, confirmText = 'confirmar', onConfirm, onCancel }) {
  return (
    <div className="confirm-modal" onClick={onCancel}>
      <div className="confirm-sheet" onClick={e => e.stopPropagation()}>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel}>
            cancelar
          </button>
          <button className="confirm-btn" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
