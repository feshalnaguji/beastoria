/** Which keys a child may use, and when the tap-to-start card is worth showing. Pure. */
export const CAMERA_KEYS: ReadonlySet<string> = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_',
]);
const EDITING_KEYS = new Set(['Backspace', 'Delete', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);

export function shouldSwallowKey(
  e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean },
  targetTag: string | null,
): boolean {
  if (targetTag === 'INPUT') {
    // Renaming: dead keys and IME composition (accents, CJK) and AltGr characters (Windows
    // reports AltGr as Ctrl+Alt) must reach the field.
    if (e.key === 'Dead' || e.key === 'Process') return false;
    if (e.ctrlKey && e.altKey && !e.metaKey && e.key.length === 1) return false;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  if (targetTag === 'INPUT' && (e.key.length === 1 || EDITING_KEYS.has(e.key))) return false; // renaming
  return !CAMERA_KEYS.has(e.key);
}

export function shouldShowTapCard(s: {
  on: boolean;
  expired: boolean;
  fullscreenEnabled: boolean;
  isFullscreen: boolean;
  overlayOpen: boolean;
}): boolean {
  return s.on && !s.expired && s.fullscreenEnabled && !s.isFullscreen && !s.overlayOpen;
}
