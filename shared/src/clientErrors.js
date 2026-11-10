import { z } from 'zod';

export const clientErrorSchema = z.object({ message: z.string().min(1).max(2000), stack: z.string().max(4000).optional(),
  route: z.string().max(500).optional(), userAgent: z.string().max(500).optional(), version: z.string().max(20).optional() });
export function sanitizeClientError(input) {
  const redact = (text = '') => String(text)
    .replace(/https?:\/\/[^\s)]+/g, (url) => { try { return new URL(url).pathname.replace(/\d{6,}/g, ':id'); } catch { return '[url]'; } })
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/(?:token|password|cookie|csrf|authorization)\s*[:=]\s*\S+/gi, '[secret]')
    .replace(/(['"])(?:(?!\1).){30,}?\1/g, '[valeur]');
  return { message: redact(input.message).slice(0, 2000), stack: redact(input.stack).slice(0, 4000),
    route: String(input.route || '').split('?')[0].replace(/\/\d+(?=\/|$)/g, '/:id').slice(0, 200),
    userAgent: /Firefox|Edg|Chrome|Safari/.exec(input.userAgent || '')?.[0] || 'navigateur', version: String(input.version || '').slice(0, 20) };
}
