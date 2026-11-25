import http from 'node:http';
import { fetch as undiciFetch } from 'undici';

export async function startFakeRedirectServer() {
  const requests = [];
  const server = http.createServer((req, res) => {
    const target = new URL(req.headers['x-target-url'] || req.url, 'https://maps.app.goo.gl');
    requests.push(target.href);
    const send = (status, headers = {}, body = '') => { res.writeHead(status, headers); res.end(body); };
    const redirect = (url) => send(302, { location: url });
    if (target.pathname.includes('network')) return req.socket.destroy();
    if (target.pathname.includes('timeout')) return;
    if (target.pathname.includes('blocked')) return redirect('http://127.0.0.1/private');
    if (target.pathname.includes('outside')) return redirect('https://evil.example/maps');
    if (target.pathname.includes('loop')) return redirect(target.href);
    if (target.pathname.includes('upstream')) return send(503);
    if (target.pathname.includes('empty')) return send(200, { 'content-type': 'text/html' }, '<title>Sans coordonnées</title>');
    if (target.pathname.includes('html')) return send(200, { 'content-type': 'text/html' }, '<meta property="og:image" content="https://maps.google.com/?center=36.7538%2C3.0588">');
    if (target.pathname.includes('pin')) return redirect('https://www.google.dz/maps/place/Place+de+test/data=!3d36.7538!4d3.0588');
    if (target.pathname.includes('consent')) return redirect('https://consent.google.com/m?continue=https%3A%2F%2Fwww.google.com%2Fmaps%2F%4036.7538%2C3.0588%2C17z');
    if (target.pathname === '/generate_204') return send(204);
    if (target.pathname === '/hop2') return redirect('https://www.google.com/maps/place/Place+de+test/@36.7538,3.0588,17z');
    if (target.pathname.includes('/maps/')) return send(200, { 'content-type': 'text/html' }, '<title>Carte de test</title>');
    if (target.pathname.includes('second')) return redirect('https://www.google.com/maps/@36.8,3.2,17z');
    if (target.pathname.includes('slow')) return setTimeout(() => redirect('https://goo.gl/hop2'), 700);
    return redirect('https://goo.gl/hop2');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base, requests, server,
    // Only the harness maps validated PUBLIC hosts to this local server. Production never does.
    fetchImpl: (url, options = {}) => undiciFetch(base, { ...options, headers: { ...options.headers, 'x-target-url': String(url) } }),
    lookupImpl: async () => [{ address: '142.250.74.196', family: 4 }],
    stop: () => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }),
  };
}
