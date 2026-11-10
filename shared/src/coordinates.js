/** Arrondi symétrique à six décimales, y compris les centres OLC à un demi-microdegré. */
export function roundCoordinate(value) {
  const n = Number(value);
  return Math.sign(n) * Math.round(Math.abs(n) * 1e6) / 1e6;
}
