/*
 * BottomSheet.jsx — Bottom sheet genérico
 * 
 * Usado em: Post.jsx (Likers), FollowModal.jsx
 * Props:
 *   - title: string
 *   - onClose: function
 *   - children: conteúdo do sheet
 */

import './BottomSheet.css'

export default function BottomSheet({ title, onClose, children }) {
  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
        <header className="bottom-sheet-header">
          <h2>{title}</h2>
          <button onClick={onClose} className="bottom-sheet-close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </header>
        <div className="bottom-sheet-content">
          {children}
        </div>
      </div>
    </div>
  )
}
