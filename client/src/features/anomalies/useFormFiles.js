import { useCallback } from 'react';
import { selectFormFiles } from '@anm/shared';

export function useFormFiles({ current, dispatch, tasks, autofill }) {
  return useCallback((incoming) => {
    const { added } = selectFormFiles(current.current.files, incoming, current.current.piecesCount || 0);
    dispatch({ type: 'FILES_ADD', files: incoming });
    if (!added.length) return;
    const jpeg = added.find((file) => file.type === 'image/jpeg');
    tasks.run('exif', async () => {
      if (!jpeg) return { ok: false, code: 'exif.aucune' };
      const exifr = await import('exifr');
      const [point, meta] = await Promise.all([exifr.gps(jpeg), exifr.parse(jpeg, ['GPSHPositioningError'])]);
      return point ? { ok: true, lat: point.latitude, lng: point.longitude, precision_m: Math.max(1, Math.round(meta?.GPSHPositioningError || 10)), source: 'exif' } : { ok: false, code: 'exif.aucune' };
    }, (result) => { if (result.ok) autofill([{ champ: 'gps', valeur: result, source: 'exif' }]); });
  }, [autofill, current, dispatch, tasks]);
}
