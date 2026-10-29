const get = (key, fallback) => {
  const raw = process.env[key];
  if (raw === undefined || raw === null || raw === '') return fallback;
  return raw;
};

export const config = {
  get port() { return Number(get('PORT', '3000')); },
  get sessionSecret() { return get('SESSION_SECRET', 'dev-insecure-secret-change-me'); },
  get dbPath() { return get('DB_PATH', './data/anomalies.db'); },
  get backupDir() { return get('BACKUP_DIR', './backups'); },
  get weekStartDay() { return Number(get('WEEK_START_DAY', '0')); },
  get adminUsername() { return get('ADMIN_USERNAME', 'admin'); },
  get adminPassword() { return get('ADMIN_PASSWORD', ''); },
};
