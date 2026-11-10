import { ALLOWED_MIME, MAX_PIECES, MAX_UPLOAD_BYTES } from './constants.js';

export function selectFormFiles(current, incoming, existingCount = 0) {
  const files = [...current]; const fileFeedback = []; const added = [];
  for (const file of incoming) {
    const code = !ALLOWED_MIME[file.type] ? 'attachments.format' : file.size > MAX_UPLOAD_BYTES ? 'attachments.size'
      : files.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified) ? 'attachments.duplicate'
        : files.length + existingCount >= MAX_PIECES ? 'attachments.limit' : null;
    if (code) fileFeedback.push({ name: file.name, code });
    else { files.push(file); added.push(file); }
  }
  return { files, fileFeedback, added };
}
