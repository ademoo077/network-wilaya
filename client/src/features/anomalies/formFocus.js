export function focusFormField(key) {
  const element = document.getElementById(key === 'gps' ? 'gps_text' : key);
  const details = element?.closest('details'); if (details) details.open = true;
  element?.focus({ preventScroll: true }); element?.scrollIntoView({ block: 'center' });
}
