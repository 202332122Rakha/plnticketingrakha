import fs from 'node:fs';

function integer(value, fallback, name, min = 1, max = 65535) {
  const raw = value === undefined || value === '' ? String(fallback) : String(value);
  if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) {
    throw new Error(`${name} harus bilangan bulat ${min}-${max}.`);
  }
  return Number(raw);
}

/** Build one PostgreSQL connection definition. Never interpolate credentials into errors. */
export function buildDbConfig(env = process.env) {
  let host = env.DB_HOST || '127.0.0.1';
  let user = env.DB_USER || 'ticketing_app';
  let password = env.DB_PASSWORD || '';
  let database = env.DB_NAME || 'pln_ticketing';
  let port = env.DB_PORT || '5432';
  let sslSetting = env.DB_SSL || 'false';
  let timeout = integer(env.DB_CONNECT_TIMEOUT_MS, 10000, 'DB_CONNECT_TIMEOUT_MS', 1, 300000);
  if (env.DATABASE_URL?.trim()) {
    let url;
    try { url = new URL(env.DATABASE_URL); } catch { throw new Error('DATABASE_URL tidak valid. Gunakan URI PostgreSQL.'); }
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL harus menggunakan PostgreSQL (postgresql://).');
    try {
      host = url.hostname;
      user = decodeURIComponent(url.username);
      password = decodeURIComponent(url.password);
      database = decodeURIComponent(url.pathname.slice(1));
    } catch { throw new Error('Encoding DATABASE_URL tidak valid.'); }
    if (!host || !user || !database || database.includes('/') || url.hash) throw new Error('DATABASE_URL harus memuat host, user, dan nama database PostgreSQL.');
    port = url.port || '5432';
    const sslmode = url.searchParams.get('sslmode');
    if (sslmode) {
      if (sslmode === 'disable') sslSetting = 'false';
      else if (['require', 'verify-ca', 'verify-full'].includes(sslmode)) sslSetting = 'true';
      else throw new Error('DATABASE_URL sslmode harus disable, require, verify-ca, atau verify-full.');
    }
    for (const key of url.searchParams.keys()) {
      if (!['sslmode','connect_timeout','application_name'].includes(key)) {
        throw new Error('Parameter DATABASE_URL tidak didukung. Gunakan DB_SSL_CA untuk sertifikat CA.');
      }
    }
    if (url.searchParams.has('connect_timeout')) timeout = integer(url.searchParams.get('connect_timeout'), 10, 'connect_timeout', 1, 300) * 1000;
  }
  if (!['true','false'].includes(String(sslSetting).toLowerCase())) throw new Error('DB_SSL harus true atau false.');
  const sslEnabled = String(sslSetting).toLowerCase() === 'true';
  const ssl = sslEnabled ? { rejectUnauthorized: true } : false;
  if (env.DB_SSL_SERVERNAME) {
    if (!sslEnabled) throw new Error('DB_SSL_SERVERNAME memerlukan DB_SSL=true.');
    if (!/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(env.DB_SSL_SERVERNAME)) throw new Error('DB_SSL_SERVERNAME tidak valid.');
    ssl.servername = env.DB_SSL_SERVERNAME;
  }
  if (env.DB_SSL_CA) {
    if (!sslEnabled) throw new Error('DB_SSL_CA memerlukan DB_SSL=true.');
    try { ssl.ca = fs.readFileSync(env.DB_SSL_CA, 'utf8'); } catch { throw new Error('File DB_SSL_CA tidak dapat dibaca.'); }
  }
  return {
    host, port: integer(port, 5432, 'DB_PORT'), user, password, database, ssl,
    max: integer(env.DB_POOL_MAX, 10, 'DB_POOL_MAX', 1, 100),
    connectionTimeoutMillis: timeout,
    idleTimeoutMillis: 30000,
    statement_timeout: integer(env.DB_STATEMENT_TIMEOUT_MS, 30000, 'DB_STATEMENT_TIMEOUT_MS', 1, 300000),
    application_name: 'pln-ticketing',
    options: '-c timezone=UTC -c search_path=public',
  };
}

export function databaseErrorMessage(error) {
  const messages = {
    ECONNREFUSED: 'PostgreSQL tidak menerima koneksi. Periksa service dan port.',
    ETIMEDOUT: 'Koneksi PostgreSQL timeout. Periksa jaringan/VPN atau SSH tunnel.',
    ENOTFOUND: 'Alamat PostgreSQL tidak ditemukan. Periksa DB_HOST dan DNS.',
    EAI_AGAIN: 'DNS PostgreSQL belum dapat dijangkau. Periksa jaringan.',
    '28P01': 'Username atau password PostgreSQL tidak valid.',
    '28000': 'Akses PostgreSQL ditolak. Periksa pg_hba.conf dan akun database.',
    '3D000': 'Database belum tersedia. Minta DBA membuat database aplikasi.',
    '42501': 'Hak akses akun PostgreSQL tidak mencukupi.',
    '42P01': 'Tabel belum tersedia. Jalankan npm run db:migrate.',
    '42703': 'Skema belum lengkap. Jalankan npm run db:migrate.',
    DEPTH_ZERO_SELF_SIGNED_CERT: 'Sertifikat PostgreSQL tidak terpercaya. Konfigurasikan DB_SSL_CA.',
    SELF_SIGNED_CERT_IN_CHAIN: 'Rantai sertifikat PostgreSQL tidak terpercaya. Konfigurasikan DB_SSL_CA.',
  };
  return messages[error?.code] || 'Koneksi atau operasi PostgreSQL gagal. Periksa konfigurasi dan log server secara lokal.';
}
