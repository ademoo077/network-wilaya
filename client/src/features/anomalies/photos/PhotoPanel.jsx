import { useState } from 'react';
import { Card, CardHeader } from '../../../components/ui/index.js';
import ErrorBoundary from '../../../components/ErrorBoundary.jsx';
import { useI18n } from '../../../i18n/index.jsx';
import PhotoComparator from './PhotoComparator.jsx';
import PhotoGallery from './PhotoGallery.jsx';
import PhotoLightbox from './PhotoLightbox.jsx';
import PhotoUploader from './PhotoUploader.jsx';
import usePhotoLibrary from './usePhotoLibrary.js';

export default function PhotoPanel({ anomalieId, pieces, sansPhotoMotif, writable, onReload }) {
  const { t } = useI18n();
  const library = usePhotoLibrary({ anomalieId, pieces, reload: onReload });
  const [lightbox, setLightbox] = useState(null);
  const avant = pieces.filter((piece) => piece.role === 'avant');
  const apres = pieces.filter((piece) => piece.role === 'apres');
  return <Card className="min-w-0" data-photo-comparison="true">
    <CardHeader title={t('photo.panelTitle')} />
    <div className="min-w-0 space-y-4 p-5">
      <ErrorBoundary fallback={<p role="alert" className="text-sm text-danger">{t('photo.panelError')}</p>}>
        <PhotoUploader onUpload={library.upload} busy={library.busy} progress={library.progress} writable={writable} />
        {library.error && <p role="alert" className="text-sm text-danger">{library.error}</p>}
        <PhotoComparator avant={avant} apres={apres} mode={library.mode} onMode={library.setMode}
          onOpen={setLightbox} onDropRole={(id, role) => library.patch(id, { role, principale: true })} />
        {sansPhotoMotif && <p data-sans-photo-motif className="rounded-md border border-border bg-surface2 p-3 text-sm text-ink2">
          <bdi><strong>{t('photo.withoutReason')} : </strong>{sansPhotoMotif}</bdi>
        </p>}
        <PhotoGallery pieces={pieces} writable={writable} library={library} onOpen={setLightbox} />
        <PhotoLightbox piece={lightbox} pieces={pieces} library={library} onClose={() => setLightbox(null)} />
      </ErrorBoundary>
    </div>
  </Card>;
}
