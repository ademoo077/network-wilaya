import { describe, it, expect } from 'vitest';
import {
  anomalieCreateSchema, anomaliePatchSchema, anomalieQuerySchema, booleanFlag,
  changePasswordSchema, loginSchema, passwordErrors, settingsSchema, userCreateSchema, zodFields,
} from '../src/schemas.js';
import { todayAlgiers } from '../src/dates.js';

describe('booleanFlag', () => {
  it('accepte les formes usuelles', () => {
    for (const value of ['1', 'true', 'oui', 'yes', 'on', true]) expect(booleanFlag.parse(value)).toBe(true);
    for (const value of ['0', 'false', 'non', 'no', 'off', false]) expect(booleanFlag.parse(value)).toBe(false);
  });

  it('laisse vide non défini', () => {
    expect(booleanFlag.parse(undefined)).toBeUndefined();
    expect(booleanFlag.parse('')).toBeUndefined();
    expect(booleanFlag.parse(null)).toBeUndefined();
  });
});

describe('mots de passe', () => {
  it('refuse trop court, sans lettre, sans chiffre, identique à l’identifiant', () => {
    expect(passwordErrors('abc1')).toContain('Au moins 10 caractères');
    expect(passwordErrors('1234567890')).toContain('Au moins une lettre');
    expect(passwordErrors('abcdefghij')).toContain('Au moins un chiffre');
    expect(passwordErrors('Admin12345', 'admin12345')).toContain('Différent de l’identifiant');
    expect(passwordErrors('Password123!', 'admin')).toEqual([]);
  });

  it('changePasswordSchema valide la politique', () => {
    expect(changePasswordSchema.safeParse({ current: 'x', next: 'Password123!' }).success).toBe(true);
    expect(changePasswordSchema.safeParse({ current: 'x', next: 'court' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('exige identifiant et mot de passe', () => {
    expect(loginSchema.safeParse({ username: '', password: '' }).success).toBe(false);
    expect(loginSchema.safeParse({ username: 'admin', password: 'x' }).success).toBe(true);
  });
});

describe('anomalieCreateSchema', () => {
  const base = {
    lien_url: 'https://facebook.com/x', domaine_id: 1, type_id: 2, daira_id: 3, commune_id: 4,
  };

  it('accepte un cas minimal et applique les valeurs par lecture', () => {
    const parsed = anomalieCreateSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    expect(parsed.data.lien_url).toBe('https://facebook.com/x');
  });

  it('rejette les dates invalides et les URLs vides', () => {
    expect(anomalieCreateSchema.safeParse({ ...base, date_signalement: '2026-02-30' }).success).toBe(false);
    expect(anomalieCreateSchema.safeParse({ ...base, date_signalement: '2026-13-01' }).success).toBe(false);
    expect(anomalieCreateSchema.safeParse({ ...base, lien_url: '' }).success).toBe(false);
  });

  it('accepte une date du jour et refuse GPS incomplet', () => {
    expect(anomalieCreateSchema.safeParse({ ...base, date_signalement: todayAlgiers() }).success).toBe(true);
    expect(anomalieCreateSchema.safeParse({ ...base, gps: { lat: 1 } }).success).toBe(false);
    expect(anomalieCreateSchema.safeParse({ ...base, gps: { lat: 200, lng: 3 } }).success).toBe(false);
  });
});

describe('anomaliePatchSchema', () => {
  it('exige la version et permet un patch partiel', () => {
    expect(anomaliePatchSchema.safeParse({ observations: 'x' }).success).toBe(false);
    const parsed = anomaliePatchSchema.safeParse({ version: 2, observations: 'x' });
    expect(parsed.success).toBe(true);
    expect(parsed.data.observations).toBe('x');
  });
});

describe('anomalieQuerySchema', () => {
  it('convertit les filtres et bornes de pagination', () => {
    const parsed = anomalieQuerySchema.safeParse({
      page: '2', pageSize: '50', domaine: '3', include_infirmees: 'oui', sort: 'reference', dir: 'asc',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ page: 2, pageSize: 50, domaine: 3, include_infirmees: true });
  });

  it('refuse un tri hors liste blanche et une page invalide', () => {
    expect(anomalieQuerySchema.safeParse({ sort: 'password_hash' }).success).toBe(false);
    expect(anomalieQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(anomalieQuerySchema.safeParse({ pageSize: '201' }).success).toBe(false);
  });
});

describe('settingsSchema', () => {
  const valid = {
    nom_cellule: 'Cellule', week_start_day: '0', delai_retard_jours: '7', exiger_verification: '1',
    tile_url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', backup_retention_days: '30',
    gps_bbox: '36.40,2.50,36.95,3.40',
  };
  it('accepte des paramètres valides', () => {
    expect(settingsSchema.safeParse(valid).success).toBe(true);
  });
  it('refuse un modèle de tuiles sans {z}/{x}/{y} et une bbox mal formée', () => {
    expect(settingsSchema.safeParse({ ...valid, tile_url: 'https://tiles.example.org/x.png' }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...valid, gps_bbox: 'nord,sud' }).success).toBe(false);
  });
});

describe('userCreateSchema', () => {
  it('valide identifiant, rôle et mot de passe', () => {
    expect(userCreateSchema.safeParse({ username: 'jean.dupont', full_name: 'Jean', role: 'operateur', password: 'Password123!' }).success).toBe(true);
    expect(userCreateSchema.safeParse({ username: 'a b', full_name: 'Jean', role: 'operateur', password: 'Password123!' }).success).toBe(false);
    expect(userCreateSchema.safeParse({ username: 'jean', full_name: 'Jean', role: 'superadmin', password: 'Password123!' }).success).toBe(false);
  });
});

describe('zodFields', () => {
  it('aplatit les erreurs par champ', () => {
    const result = anomalieCreateSchema.safeParse({ lien_url: '', domaine_id: 1, type_id: 2, daira_id: 3, commune_id: 4 });
    expect(result.success).toBe(false);
    const fields = zodFields(result.error);
    expect(fields.lien_url).toBeTruthy();
  });
});
