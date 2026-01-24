import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: [
    // Match all pathnames except for
    // - /api (API routes)
    // - /_next (Next.js internals)
    // - /_vercel (Vercel internals)
    // - /static (inside /public)
    // - all root files like favicon.ico, robots.txt, sitemap.xml
    '/((?!api|_next|_vercel|static|.*\\..*).*)',
  ],
};
