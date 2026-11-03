import { useEffect, useRef, type RefObject } from 'react';

/** Keyboard access without layout or stylesheet changes. */
export function useDialogFocus(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]'
    )).filter(node => !node.closest('[hidden]') && window.getComputedStyle(node).display !== 'none');
    (controls()[0] ?? dialog).focus();
    const keydown = (event: KeyboardEvent) => {
      if (!dialog.contains(document.activeElement)) return;
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const nodes = controls(), first = nodes[0], last = nodes.at(-1);
      if (!first) { event.preventDefault(); dialog.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown',keydown);
    return () => {
      document.removeEventListener('keydown',keydown);
      if (previous?.isConnected) previous.focus();
    };
  }, [open,ref]);
}
