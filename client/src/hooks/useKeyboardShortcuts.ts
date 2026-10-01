import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';

/**
 * Global editor shortcuts.
 *
 * Every shortcut is ignored while the user is typing (input, textarea, select,
 * contenteditable, or the off-screen textarea Fabric uses for canvas text
 * editing), so pressing Delete while editing text can never delete an element.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  if (target.closest('.canvas-container')) return true;
  return false;
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const store = useEditorStore.getState();
      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }

      if (modifier && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        store.redo();
        return;
      }

      if (modifier && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void store.persistNow();
        return;
      }

      if (modifier && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        const slideId = store.activeSlideId;
        if (slideId) store.duplicateSlide(slideId);
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (store.activeElementIds.length === 0) return;
        event.preventDefault();
        for (const elementId of [...store.activeElementIds]) store.deleteElement(elementId);
        return;
      }

      if (event.key === 'Escape') {
        store.setActiveElements([]);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
