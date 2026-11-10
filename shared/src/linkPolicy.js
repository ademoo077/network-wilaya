export const hostMatches = (host, suffix) => host === suffix || host.endsWith(`.${suffix}`);
export const GOOGLE_RESOLVE_DOMAINS = ['google.com', 'google.dz', 'google.fr'];
export const SHORT_MAP_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'g.co', 'share.google'];
export const SOCIAL_RESOLVE_DOMAINS = ['tiktok.com', 'facebook.com', 'fb.watch', 'instagram.com', 'instagr.am', 'youtube.com', 'youtu.be', 'x.com', 'twitter.com', 't.co'];
export function isGoogleHost(host) {
  return /^(?:(?:www|maps|consent)\.)?google\.(?:com|[a-z]{2}|(?:co|com)\.[a-z]{2})$/.test(host);
}
export function isMapUrl(url) {
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  return SHORT_MAP_HOSTS.includes(host) || isGoogleHost(host) && (host.startsWith('maps.') || url.pathname.startsWith('/maps'))
    || ['waze.com', 'maps.apple.com', 'openstreetmap.org', 'bing.com', 'yandex.ru', 'yandex.com', 'yandex.kz', 'here.com'].some((h) => hostMatches(host, h));
}
export function isShortMapUrl(url) {
  return ['maps.app.goo.gl', 'share.google'].includes(url.hostname)
    || url.hostname === 'goo.gl' && url.pathname.startsWith('/maps')
    || url.hostname === 'g.co' && url.pathname.startsWith('/kgs');
}
export function isShortSocialUrl(url) {
  return ['vm.tiktok.com', 'vt.tiktok.com', 'fb.watch', 'instagr.am', 't.co', 'youtu.be'].includes(url.hostname)
    || hostMatches(url.hostname, 'facebook.com') && url.pathname.startsWith('/share/');
}
export function isAllowedResolveHost(host, social = true) {
  return SHORT_MAP_HOSTS.includes(host) || GOOGLE_RESOLVE_DOMAINS.some((suffix) => hostMatches(host, suffix))
    || social && SOCIAL_RESOLVE_DOMAINS.some((suffix) => hostMatches(host, suffix));
}
