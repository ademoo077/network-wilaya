import fs from 'node:fs';
import sharp from 'sharp';
import { formatDate } from '@anm/shared';
import { getPiece, listPhotoPairs } from './attachments.js';
import { cheminDerive, resolveStored } from './photoPipeline.js';

/**
 * V13 — planche photographique A4 sans dépendance PDF externe.
 * Les images sont des JPEG DCTDecode natifs ; le texte reste ASCII afin de
 * garantir un rendu stable sans police embarquée ni ressource distante.
 */
const PAGE = Object.freeze({ largeur: 842, hauteur: 595 });
const IMAGE = Object.freeze({ largeur: 320, hauteur: 240 });

function textePdf(valeur) {
  return String(valeur ?? '')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

async function imageJpeg(row) {
  const chemin = cheminDerive(row, 'moyen', 'jpg') || resolveStored(row?.chemin);
  if (!chemin || !fs.existsSync(chemin)) {
    return sharp({ create: { width: IMAGE.largeur, height: IMAGE.hauteur, channels: 3,
      background: { r: 245, g: 245, b: 245 } } }).jpeg({ quality: 80 }).toBuffer();
  }
  return sharp(chemin).rotate().resize(IMAGE.largeur, IMAGE.hauteur, { fit: 'cover' })
    .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

function lieu(pair, lang) {
  const commune = lang === 'ar' ? pair.commune?.ar : pair.commune?.fr;
  const daira = lang === 'ar' ? pair.daira?.ar : pair.daira?.fr;
  return [commune, daira].filter(Boolean).join(' / ');
}

function dessinerPaire({ pair, x, haut, largeur, buffers, enregistrerImage, lang }) {
  const largeurImage = largeur / 2 - 15;
  const imageH = IMAGE.hauteur * (largeurImage / IMAGE.largeur);
  const cardH = 24 + imageH + 42;
  const bas = haut - cardH;
  const commandes = [
    '0.85 0.85 0.85 RG', `${x} ${bas} ${largeur} ${cardH} re S`,
    'BT /F1 10 Tf', `${x + 8} ${haut - 15} Td`, `(${textePdf(pair.reference)}) Tj`, 'ET',
  ];
  buffers.forEach((buffer, index) => {
    if (!buffer) return;
    const nom = enregistrerImage(buffer);
    const ix = x + 8 + index * (largeur / 2 - 1);
    commandes.push(`q ${largeurImage} 0 0 ${imageH} ${ix} ${bas + 42} cm /${nom} Do Q`);
  });
  const dates = [formatDate(pair.date_signalement), formatDate(pair.date_traitement)]
    .filter(Boolean).join(' - ');
  commandes.push('BT /F1 8 Tf', `${x + 8} ${bas + 28} Td`,
    `(${textePdf(lieu(pair, lang))}) Tj`, '0 -11 Td', `(${textePdf(dates)}) Tj`, '0 -11 Td',
    `(${textePdf(pair.intervenant || '')}) Tj`, 'ET');
  if (buffers.filter(Boolean).length === 2) {
    const roleAvant = lang === 'ar' ? '?' : 'Avant';
    const roleApres = lang === 'ar' ? '?' : 'Apres';
    commandes.push('BT /F1 7 Tf', `${x + 12} ${bas + imageH + 46} Td`, `(${roleAvant}) Tj`,
      `${x + largeur / 2 + 4} ${bas + imageH + 46} Td`, `(${roleApres}) Tj`, 'ET');
  }
  return commandes;
}

function assembler(objets) {
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  const ids = [...objets.keys()].sort((a, b) => a - b);
  for (const id of ids) {
    offsets[id] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${id} 0 obj\n`;
    const objet = objets.get(id);
    pdf += typeof objet === 'string' ? `${objet}\nendobj\n` : `${objet.toString('latin1')}\nendobj\n`;
  }
  const debutXref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${ids.length + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= ids.length; id += 1) {
    pdf += `${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${ids.length + 1} /Root 1 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

export async function buildPhotoSheet(db, { debut, fin, limite = 12, parPage = 2, lang = 'fr' } = {}) {
  const paires = listPhotoPairs(db, { debut, fin, limite });
  const parPageEffective = parPage === 4 ? 4 : 2;
  const total = Math.max(1, Math.ceil(paires.length / parPageEffective));
  const objets = new Map([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, `<< /Type /Pages /Count ${total} /Kids [${Array.from({ length: total }, (_, i) => `${4 + i * 2} 0 R`).join(' ')}] >>`],
    [3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'],
  ]);
  let prochaineImage = 4 + total * 2;
  const marge = 24;
  const largeur = (PAGE.largeur - 2 * marge - 12) / 2;

  for (let index = 0; index < total; index += 1) {
    const pageId = 4 + index * 2;
    const contentId = pageId + 1;
    const page = { images: [], flux: '' };
    const tranche = paires.slice(index * parPageEffective, (index + 1) * parPageEffective);
    const commandes = [
      'BT /F1 11 Tf 24 578 Td', `(Planche avant/apres - Wilaya d'Alger) Tj`, 'ET',
      'BT /F1 8 Tf 24 20 Td', `(Page ${index + 1} / ${total}) Tj`, 'ET',
    ];
    const enregistrerImage = (buffer) => {
      const id = prochaineImage;
      prochaineImage += 1;
      const nom = `Im${id}`;
      page.images.push({ id, nom, buffer });
      return nom;
    };
    for (const [position, pair] of tranche.entries()) {
      const rangee = Math.floor(position / 2);
      const colonne = position % 2;
      const x = marge + colonne * (largeur + 12);
      const haut = 554 - rangee * 252;
      const buffers = [];
      for (const piece of [pair.avant, pair.apres]) {
        const found = piece ? getPiece(db, piece.id) : null;
        buffers.push(found ? await imageJpeg(found) : null);
      }
      commandes.push(...dessinerPaire({ pair, x, haut, largeur, buffers, enregistrerImage, lang }));
    }
    page.flux = commandes.join('\n');
    const xobj = page.images.map((image) => `/${image.nom} ${image.id} 0 R`).join(' ');
    objets.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.largeur} ${PAGE.hauteur}] `
      + `/Resources << /Font << /F1 3 0 R >> /XObject << ${xobj} >> >> /Contents ${contentId} 0 R >>`);
    objets.set(contentId, `<< /Length ${Buffer.byteLength(page.flux, 'latin1')} >>\nstream\n${page.flux}\nendstream`);
    for (const image of page.images) {
      objets.set(image.id, Buffer.concat([
        Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${IMAGE.largeur} /Height ${IMAGE.hauteur} `
          + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.buffer.length} >>\nstream\n`, 'latin1'),
        image.buffer,
        Buffer.from('\nendstream', 'latin1'),
      ]));
    }
  }
  return { buffer: assembler(objets), count: paires.length,
    filename: `planche-photos-${new Date().toISOString().slice(0, 10)}.pdf` };
}
