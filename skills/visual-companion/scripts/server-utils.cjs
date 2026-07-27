'use strict';

const crypto = require('crypto');

function urlHostForHttp(host) {
  const normalized = String(host);
  if (normalized.startsWith('[') && normalized.endsWith(']')) return normalized;
  return normalized.includes(':') ? '[' + normalized + ']' : normalized;
}

function browserLauncherForPlatform(url, options = {}) {
  const platform = options.platform || process.platform;
  const osRelease = options.osRelease || require('os').release();
  const env = options.env || process.env;
  const isWSL = platform === 'linux' && /microsoft/i.test(osRelease);

  if (platform === 'darwin') return { bin: 'open', args: [url] };
  if (platform === 'win32' || isWSL) {
    return { bin: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url] };
  }
  if (env.DISPLAY || env.WAYLAND_DISPLAY) return { bin: 'xdg-open', args: [url] };
  return null;
}

function timingSafeEqualStr(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(header) {
  const output = {};
  if (!header) return output;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    output[part.slice(0, separator).trim()] = part.slice(separator + 1).trim();
  }
  return output;
}

function pathnameOf(url) {
  const queryIndex = url.indexOf('?');
  return queryIndex >= 0 ? url.slice(0, queryIndex) : url;
}

function queryKey(url) {
  const queryIndex = url.indexOf('?');
  if (queryIndex < 0) return null;
  return new URLSearchParams(url.slice(queryIndex + 1)).get('key');
}

function securityHeaders(headers = {}) {
  return {
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'",
    'Cross-Origin-Resource-Policy': 'same-origin',
    ...headers,
  };
}

function isAllowedWebSocketOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers.host;
  if (!host) return false;
  return origin === 'http://' + host;
}

module.exports = {
  urlHostForHttp,
  browserLauncherForPlatform,
  timingSafeEqualStr,
  parseCookies,
  pathnameOf,
  queryKey,
  securityHeaders,
  isAllowedWebSocketOrigin,
};
