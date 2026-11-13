/**
 * Returns true only when the primary pointer is fine (desktop mouse/trackpad),
 * avoiding unwanted virtual keyboard popups on phones and tablets.
 */
export function canAutoFocusInput(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(pointer: fine)').matches;
}
