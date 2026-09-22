// In-page replacements for alert(), confirm() and prompt(). Pages call these
// directly; <Notifications /> (mounted once in App) subscribes and renders them.

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

export interface DialogOption {
  value: string;
  label: string;
}

export interface Dialog {
  id: number;
  title?: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  // Present for a choose() dialog, absent for a plain confirm()
  options?: DialogOption[];
  defaultValue?: string;
  resolve: (value: string | null) => void;
}

interface State {
  toasts: Toast[];
  dialog: Dialog | null;
}

let state: State = { toasts: [], dialog: null };
const queue: Dialog[] = [];
const listeners = new Set<(s: State) => void>();
let nextId = 1;

const emit = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
};

export const subscribe = (listener: (s: State) => void) => {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
};

export const dismissToast = (id: number) => {
  emit({ toasts: state.toasts.filter((t) => t.id !== id) });
};

const show = (type: ToastType, message: string) => {
  const id = nextId++;
  // Keep the last few so a burst of errors doesn't fill the screen
  emit({ toasts: [...state.toasts, { id, type, message }].slice(-4) });
  // Errors stay until dismissed so they aren't missed
  if (type !== 'error') setTimeout(() => dismissToast(id), 4000);
};

export const notify = {
  success: (message: string) => show('success', message),
  error: (message: string) => show('error', message),
  info: (message: string) => show('info', message),
};

const openDialog = (dialog: Omit<Dialog, 'id' | 'resolve'>) =>
  new Promise<string | null>((resolve) => {
    const entry = { ...dialog, id: nextId++, resolve };
    if (state.dialog) queue.push(entry);
    else emit({ dialog: entry });
  });

export const closeDialog = (value: string | null) => {
  state.dialog?.resolve(value);
  emit({ dialog: queue.shift() ?? null });
};

export const confirmDialog = async (
  message: string,
  opts: { title?: string; confirmLabel?: string; danger?: boolean } = {}
): Promise<boolean> => {
  const result = await openDialog({
    message,
    title: opts.title ?? 'Please confirm',
    confirmLabel: opts.confirmLabel ?? 'OK',
    danger: opts.danger ?? false,
  });
  return result !== null;
};

export const chooseDialog = (
  message: string,
  options: DialogOption[],
  opts: { title?: string; confirmLabel?: string; defaultValue?: string } = {}
): Promise<string | null> =>
  openDialog({
    message,
    options,
    title: opts.title ?? 'Choose an option',
    confirmLabel: opts.confirmLabel ?? 'OK',
    danger: false,
    defaultValue: opts.defaultValue ?? options[0]?.value,
  });
