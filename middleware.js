// Espil Online - Google verification homepage split (Option A).
//
// Purpose: Google's verification / inspection crawlers receive the lightweight
// static homepage (/home-static.html) at the SAME address "/" - app name,
// truthful description, and the /privacy + /terms links its branding check
// requires (see google-verify/DIAGNOSIS.md). Every other visitor receives the
// game landing byte-unchanged. The static page represents the same app
// truthfully; its own "Enter" link points to /?full=1, and any request
// carrying full=1 passes through to the game regardless of user agent.
//
// Form: Vercel Routing Middleware, framework-less ("other") variant per
// https://vercel.com/docs/routing-middleware/js-reference - default export,
// config matcher, and the rewrite/next helpers from @vercel/functions.
// The matcher is exactly "/", so this code can only ever run for the root
// path - never for /privacy, /terms, /vancouver.html, /api/*, or any asset.

import { next, rewrite } from '@vercel/functions';

export const config = {
  matcher: '/',
};

// Verification / inspection crawler family only (DIAGNOSIS §2.2) - matched as
// case-insensitive substrings of the User-Agent header. Deliberately NOT a
// general bot list. The favicon fetcher appears in the wild with BOTH the
// hyphenated token from §2.2 and a space form ("... Safari/537.36
// Google Favicon"), so both spellings are listed; each matches only that
// fetcher.
const CRAWLER_UA_TOKENS = [
  'google-inspectiontool',
  'googlebot',
  'adsbot-google',
  'storebot-google',
  'mediapartners-google',
  'google-favicon',
  'google favicon',
];

export default function middleware(request) {
  const url = new URL(request.url);

  // Escape hatch first: full=1 always reaches the game, whatever the UA.
  if (url.searchParams.get('full') === '1') {
    return next();
  }

  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  const isCrawler = CRAWLER_UA_TOKENS.some((token) => ua.includes(token));
  if (!isCrawler) {
    return next();
  }

  // Internal rewrite: the address stays "/", the document served is the
  // static verification homepage. The marker header lets later log reads and
  // live checks prove which variant a fetch received (DIAGNOSIS §2.1, §2.6).
  const response = rewrite(new URL('/home-static.html', request.url));
  response.headers.set('x-espil-home-variant', 'static');
  return response;
}
