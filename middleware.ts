/**
 * Next.js Middleware - Security & Rate Limiting
 * 
 * Applies security headers and rate limiting to all requests
 */

import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory rate limiter (for production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50, // 50 requests per window
};

function getRateLimitKey(request: NextRequest): string {
  // Use IP address or fallback to a header
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
  return `ratelimit:${ip}`;
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  // Clean up old entries periodically
  if (rateLimitMap.size > 10000) {
    rateLimitMap.clear();
  }

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs,
    });
    return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1 };
  }

  if (record.count >= RATE_LIMIT.maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT.maxRequests - record.count };
}

export function middleware(request: NextRequest) {
  // Apply rate limiting to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const key = getRateLimitKey(request);
    const { allowed, remaining } = checkRateLimit(key);

    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(RATE_LIMIT.windowMs / 1000)),
            'X-RateLimit-Limit': String(RATE_LIMIT.maxRequests),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    // Create response with rate limit headers
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT.maxRequests));
    response.headers.set('X-RateLimit-Remaining', String(remaining));

    // Security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), interest-cohort=()'
    );

    return response;
  }

  // Security headers for all routes
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, icon-*.png (icons)
     * - sw.js (service worker)
     * - manifest.json
     */
    '/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|icon-.*\\.svg|sw.js|manifest.json).*)',
  ],
};
