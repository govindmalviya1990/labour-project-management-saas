import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/auth/jwt';
import { normalizeRole } from '@/lib/auth/roles';

const AUTH_COOKIE_NAME = 'auth_token';

// Public routes that don't require authentication
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip static assets, Next internal files, and favicon
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/register') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  // 2. Handle unauthenticated requests to public routes
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (token) {
      const payload = await verifyJWT(token);
      if (payload?.userId) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
    return NextResponse.next();
  }

  // 3. For any other page / api route: verify token
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifyJWT(token);
  if (!payload || !payload.userId) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized: Session expired' }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }

  const role = normalizeRole(payload.role as string | undefined);

  // 4. Role-based Route Protection for Pages
  if (!pathname.startsWith('/api/')) {
    // OWNER and MANAGER have access to everything
    if (role === 'OWNER' || role === 'MANAGER') {
      return NextResponse.next();
    }

    // Settings & Users: strictly OWNER and MANAGER
    if (pathname.startsWith('/settings') || pathname.startsWith('/users')) {
      return NextResponse.redirect(new URL('/?denied=admin_only', request.url));
    }

    // Finance & Salary: blocked for SUPERVISOR and LABOUR
    if (pathname.startsWith('/finance') || pathname.startsWith('/salary')) {
      return NextResponse.redirect(new URL('/?denied=finance_restricted', request.url));
    }

    // Quotations: blocked for SUPERVISOR and LABOUR
    if (pathname.startsWith('/quotations') && (role === 'SITE_SUPERVISOR' || role === 'LABOUR')) {
      return NextResponse.redirect(new URL('/?denied=quotations_restricted', request.url));
    }

    // Reports: blocked for SUPERVISOR and LABOUR
    if (pathname.startsWith('/reports') && (role === 'SITE_SUPERVISOR' || role === 'LABOUR')) {
      return NextResponse.redirect(new URL('/?denied=reports_restricted', request.url));
    }

    // LABOUR Role: strictly restricted to overview (/), attendance (/attendance), and personal ledger (/khata)
    if (role === 'LABOUR') {
      if (
        pathname.startsWith('/projects') ||
        pathname.startsWith('/workers') ||
        pathname.startsWith('/materials') ||
        pathname.startsWith('/work')
      ) {
        return NextResponse.redirect(new URL('/?denied=labour_restricted', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
