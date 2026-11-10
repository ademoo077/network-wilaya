import { validateAnomalyState } from '@anm/shared';
import { business } from '../utils/errors.js';

/** Adaptation HTTP de la validation métier partagée. */
export function validerEtat(state, options = {}) {
  try { return validateAnomalyState(state, options); }
  catch (error) { throw business(error.message, error.code, error.fields); }
}
