import { useEffect, useRef, useState } from 'react';
import { subscribe, dismissToast, closeDialog, Toast, Dialog } from '../utils/notify';
import './Notifications.css';

export default function Notifications() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [choice, setChoice] = useState('');
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(
    () =>
      subscribe((s) => {
        setToasts(s.toasts);
        setDialog(s.dialog);
      }),
    []
  );

  useEffect(() => {
    if (!dialog) return;
    setChoice(dialog.defaultValue ?? '');
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDialog(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

  return (
    <>
      <div className="app-toasts">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`app-toast ${t.type}`}
            role={t.type === 'error' ? 'alert' : 'status'}
          >
            <span className="app-toast-message">{t.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
              ×
            </button>
          </div>
        ))}
      </div>

      {dialog && (
        <div className="app-dialog-overlay" onClick={() => closeDialog(null)}>
          <div
            className="app-dialog"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {dialog.title && <h3>{dialog.title}</h3>}
            <p className="app-dialog-message">{dialog.message}</p>
            {dialog.options && (
              <select value={choice} onChange={(e) => setChoice(e.target.value)}>
                {dialog.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            <div className="app-dialog-actions">
              <button type="button" className="app-dialog-cancel" onClick={() => closeDialog(null)}>
                Cancel
              </button>
              <button
                type="button"
                ref={confirmRef}
                className={`app-dialog-confirm ${dialog.danger ? 'danger' : ''}`}
                onClick={() => closeDialog(dialog.options ? choice : 'ok')}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
