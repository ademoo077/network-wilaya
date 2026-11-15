const AR_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const AR_TATWEEL = /\u0640/g;
const LATIN_DIACRITICS = /[\u0300-\u036f]/g;
const ARABIC_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
const ARABIZI = { '3': 'ع', '7': 'ح', '9': 'ق', '5': 'خ', '8': 'غ', '6': 'ط', '2': 'ء' };
const ARABIC_LETTER = /[\u0600-\u06FF]/;

export function foldLatin(value = '') {
  return String(value).normalize('NFKC').toLowerCase()
    .replace(/[‘’ʻʼ`´]/g, "'")
    .replace(LATIN_DIACRITICS, '')
    .replace(/\u0153/g, 'oe').replace(/\u00e6/g, 'ae');
}

export function normalizeArabic(value = '') {
  return String(value).normalize('NFKC')
    .replace(AR_DIACRITICS, '').replace(AR_TATWEEL, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/([\u0600-\u06FF])\1{2,}/g, '$1$1')
    .replace(/\s+/g, ' ').trim();
}

function stripArabicAffixes(token) {
  if (token.length < 4) return token;
  let root = token.replace(/^(وال|بال|كال|فال|لل|ال|و|ب|ل|ف|ك|س)/, '');
  if (root.length < 3) root = token;
  return root.replace(/(ات|ون|ين|ها|هم|هما|كم|كن|نا|ه|ي)$/u, '') || root;
}

export function rootArabic(value = '') {
  return normalizeArabic(value).split(' ')
    .map((token) => ARABIC_LETTER.test(token) ? stripArabicAffixes(token) : normalizeLatinToken(token))
    .filter(Boolean).join(' ');
}

export function normalizeLatinToken(token = '') {
  let out = foldLatin(token).replace(/[^a-z0-9]/g, '');
  if (out.length > 4) out = out.replace(/(aux|es|s|x)$/, '');
  return out;
}

export function arabiziToArabic(value = '') {
  let out = foldLatin(value).replace(/[^a-z0-9\u0600-\u06FF ]/g, '');
  out = out.replace(/ch/g, 'ش').replace(/kh/g, 'خ').replace(/gh/g, 'غ').replace(/ou/g, 'و').replace(/th/g, 'ث');
  out = out.replace(/[3795826]/g, (digit) => ARABIZI[digit] || digit);
  return normalizeArabic(out);
}

export function cleanText(value = '') {
  return String(value).slice(0, 10000)
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/www\.\S+/gi, ' ')
    .replace(/@[\w.]+/g, ' ')
    .replace(/#/g, ' ')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/[٠-٩]/g, (digit) => ARABIC_DIGITS[digit] || digit)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function tokens(value = '') {
  return cleanText(value).split(' ').filter(Boolean);
}

export function latinTokens(value = '') {
  return tokens(value).map((token) => normalizeLatinToken(token)).filter(Boolean);
}

export function normalizeForMatch(value = '') {
  return rootArabic(value);
}

export function normalizeTerm(term, langue = 'fr') {
  if (langue === 'ar') return rootArabic(term);
  if (langue === 'dz') return tokens(term).map((token) => foldLatin(token).replace(/[^a-z0-9]/g, '')).filter(Boolean).join(' ');
  return tokens(term).map((token) => normalizeLatinToken(token)).filter(Boolean).join(' ');
}

export function detectLanguage(value = '') {
  const letters = [...String(value)].filter((char) => /\p{L}/u.test(char));
  if (!letters.length) return 'mix';
  const arabic = letters.filter((char) => ARABIC_LETTER.test(char)).length;
  const ratio = arabic / letters.length;
  if (ratio > 0.7) return 'ar';
  if (ratio < 0.3) return 'fr';
  return 'mix';
}

export function hasArabic(value = '') {
  return ARABIC_LETTER.test(String(value));
}
