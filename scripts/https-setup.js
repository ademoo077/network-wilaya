import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import readline from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import selfsigned from 'selfsigned';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function argsOf(argv) {
  return Object.fromEntries(argv.filter((arg) => arg.startsWith('--')).map((arg) => {
    const [key, ...parts] = arg.slice(2).split('=');
    return [key, parts.join('=') || true];
  }));
}

function localIps() {
  return [...new Set(Object.values(os.networkInterfaces()).flat().filter((item) => item && !item.internal && [4, 6, 'IPv4', 'IPv6'].includes(item.family)).map((item) => item.address))];
}

function setEnv(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  return pattern.test(content) ? content.replace(pattern, line) : `${content.replace(/\s*$/, '\n')}${line}\n`;
}

export async function generateHttpsSetup(options = {}) {
  const hostname = options.hostname || os.hostname();
  const ips = [...new Set((options.ips || localIps()).filter((ip) => net.isIP(ip)))];
  const certDir = path.resolve(options.certDir || path.join(root, 'data', 'certs'));
  const envPath = path.resolve(options.envPath || path.join(root, '.env'));
  fs.mkdirSync(certDir, { recursive: true });
  const altNames = [
    ...new Set(['localhost', hostname].filter(Boolean)).values(),
  ].map((value) => ({ type: 2, value }));
  altNames.push(...['127.0.0.1', '::1', ...ips].filter((ip, index, all) => all.indexOf(ip) === index).map((ip) => ({ type: 7, ip })));
  const start = new Date();
  const end = new Date(start.getTime() + 825 * 86400000);
  const pems = await selfsigned.generate([{ name: 'commonName', value: hostname }], {
    keyType: 'rsa', keySize: 2048, algorithm: 'sha256', notBeforeDate: start, notAfterDate: end,
    extensions: [
      { name: 'basicConstraints', cA: false, critical: true },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
      { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames },
    ],
  });
  const certPath = path.join(certDir, 'server-cert.pem');
  const keyPath = path.join(certDir, 'server-key.pem');
  fs.writeFileSync(certPath, pems.cert, 'utf8');
  fs.writeFileSync(keyPath, pems.private, { encoding: 'utf8', mode: 0o600 });
  let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const relative = (file) => `./${path.relative(root, file).replace(/\\/g, '/')}`;
  env = setEnv(env, 'HTTPS', 'true');
  env = setEnv(env, 'HTTPS_CERT', relative(certPath));
  env = setEnv(env, 'HTTPS_KEY', relative(keyPath));
  env = setEnv(env, 'COOKIE_SECURE', 'true');
  fs.writeFileSync(envPath, env, 'utf8');
  return { hostname, ips, certPath, keyPath, envPath, validUntil: end.toISOString(), fingerprint: pems.fingerprint };
}

async function main() {
  const args = argsOf(process.argv.slice(2));
  let hostname = args.hostname === true ? null : args.hostname;
  let ips = args.ips === true ? [] : String(args.ips || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (process.stdin.isTTY && (!hostname || !ips.length)) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    hostname ||= (await rl.question(`Nom d'hôte [${os.hostname()}] : `)).trim() || os.hostname();
    if (!ips.length) {
      const detected = localIps();
      ips = (await rl.question(`IP locales séparées par des virgules [${detected.join(',')}] : `)).split(',').map((value) => value.trim()).filter(Boolean);
      if (!ips.length) ips = detected;
    }
    rl.close();
  }
  const result = await generateHttpsSetup({
    hostname: hostname || os.hostname(), ips: ips.length ? ips : localIps(),
    certDir: args['cert-dir'], envPath: args.env,
  });
  console.log(`Certificat créé : ${result.certPath}`);
  console.log(`Valide jusqu'au : ${result.validUntil}`);
  console.log('.env configuré pour HTTPS. Redémarrez le serveur et approuvez le certificat sur les appareils clients.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(`Configuration HTTPS impossible : ${error.message}`); process.exit(1); });
}
