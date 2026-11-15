import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { freshDatabase } from './helpers.js';
import { createCaptureToken } from '../src/veille/tokens.js';
import { resetCaptureRateLimit } from '../src/veille/capture.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const extensionDir = path.join(root, 'extension');
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(extensionDir, name), 'utf8'));

let app; let db; let token;

beforeAll(() => {
  let userIds;
  ({ db, userIds } = freshDatabase());
  app = createApp();
  token = createCaptureToken(db, userIds.operateur, 'Extension E2E').token;
  resetCaptureRateLimit();
});

describe('Extension de capture — manifeste minimal', () => {
  it('ne demande que les permissions nécessaires et aucun script permanent', () => {
    const manifest = readJson('manifest.json');
    expect(manifest.manifest_version).toBe(3);
    expect([...manifest.permissions].sort()).toEqual(['activeTab', 'scripting', 'storage']);
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.background).toBeUndefined();
    expect(manifest.externally_connectable).toBeUndefined();
    expect(manifest.action.default_popup).toBe('popup.html');
    expect(manifest.options_ui.page).toBe('options.html');
  });

  it('référence uniquement des fichiers locaux existants', () => {
    const manifest = readJson('manifest.json');
    const files = [manifest.action.default_popup, manifest.options_ui.page];
    for (const file of files) expect(fs.existsSync(path.join(extensionDir, file))).toBe(true);
    const popup = fs.readFileSync(path.join(extensionDir, 'popup.html'), 'utf8');
    expect(popup).not.toMatch(/<script[^>]+src=["']https?:/i);
    expect(popup).not.toMatch(/<link[^>]+href=["']https?:/i);
    for (const script of ['shared.js', 'popup.js']) expect(popup).toContain(script);
    for (const script of ['shared.js', 'options.js']) {
      expect(fs.readFileSync(path.join(extensionDir, 'options.html'), 'utf8')).toContain(script);
    }
  });

  it('n’utilise ni code distant ni évaluation dynamique', () => {
    for (const file of ['shared.js', 'popup.js', 'options.js']) {
      const source = fs.readFileSync(path.join(extensionDir, file), 'utf8');
      expect(source).not.toMatch(/\beval\s*\(/);
      expect(source).not.toMatch(/new\s+Function\s*\(/);
      expect(source).not.toMatch(/import\s*\(\s*['"]https?:/i);
      expect(source).not.toMatch(/document\.write\s*\(/);
      expect(source).not.toMatch(/innerHTML\s*=/);
    }
  });
});

describe('CORS de capture assistée', () => {
  const origin = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

  it('répond au préliminaire d’une origine d’extension', async () => {
    const res = await request(app).options('/api/veille/capture').set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    expect(res.headers['access-control-allow-headers'].toLowerCase()).toContain('authorization');
    expect(res.headers.vary).toContain('Origin');
  });

  it('refuse le préliminaire d’une origine web quelconque', async () => {
    const res = await request(app).options('/api/veille/capture').set('Origin', 'https://exemple.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('accepte une capture authentifiée par jeton depuis l’extension', async () => {
    const res = await request(app).post('/api/veille/capture').set('Origin', origin)
      .set('Authorization', `Bearer ${token}`)
      .send({ texte: 'Trottoir dégradé devant la mairie, signalement citoyen', url: 'https://exemple.dz/extension/1', page_nom: 'Page citoyenne' });
    expect(res.status).toBe(201);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.body.item.id).toBeTruthy();
    expect(res.body.statut).toBeTruthy();
  });

  it('n’ajoute pas d’en-tête CORS à une capture sans origine d’extension', async () => {
    const res = await request(app).post('/api/veille/capture').set('Origin', 'https://exemple.example')
      .set('Authorization', `Bearer ${token}`)
      .send({ texte: 'Éclairage public coupé sur la place centrale', url: 'https://exemple.dz/extension/2' });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('refuse toujours un jeton absent malgré une origine d’extension', async () => {
    const res = await request(app).post('/api/veille/capture').set('Origin', origin)
      .send({ texte: 'Nid de poule signalé sans jeton valide', url: 'https://exemple.dz/extension/3' });
    expect(res.status).toBe(401);
  });
});
