const table = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  table[n] = value >>> 0;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function record(name, data, crc, offset, central) {
  const buffer = new Uint8Array((central ? 46 : 30) + name.length);
  const view = new DataView(buffer.buffer);
  view.setUint32(0, central ? 0x02014b50 : 0x04034b50, true);
  view.setUint16(central ? 4 : 4, 20, true);
  view.setUint16(central ? 6 : 6, 0, true);
  view.setUint16(central ? 8 : 8, 0, true);
  view.setUint16(central ? 10 : 10, 0, true);
  view.setUint16(central ? 12 : 12, 0, true);
  view.setUint32(central ? 16 : 14, crc, true);
  view.setUint32(central ? 20 : 18, data.length, true);
  view.setUint32(central ? 24 : 22, data.length, true);
  view.setUint16(central ? 28 : 26, name.length, true);
  if (central) {
    view.setUint32(42, offset, true);
    buffer.set(name, 46);
  } else buffer.set(name, 30);
  return buffer;
}

/** Archives les pièces sélectionnées sans dépendance externe (ZIP stocké). */
export function buildZip(entries) {
  const encoder = new TextEncoder();
  const local = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name.replace(/[\\/]+/g, '_').slice(0, 180) || 'piece');
    const bytes = entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes);
    const crc = crc32(bytes);
    const head = record(name, bytes, crc, offset, false);
    local.push(head, bytes);
    central.push(record(name, bytes, crc, offset, true));
    offset += head.length + bytes.length;
  }
  const directorySize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, entries.length, true);
  view.setUint16(10, entries.length, true);
  view.setUint32(12, directorySize, true);
  view.setUint32(16, offset, true);
  return new Blob([...local, ...central, end], { type: 'application/zip' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
