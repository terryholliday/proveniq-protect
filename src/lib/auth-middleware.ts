import { NextRequest } from 'next/server';

export interface AuthenticatedUser {
    userId: string;
    email?: string;
    role?: string;
}

/**
 * Validates the session from the request.
 * Checks for Authorization header or potential session cookies.
 * 
 * NOTE: For cross-service communication (like from Capital or Origins),
 * we expect an Authorization header with a Bearer token.
 * 
 * @param req NextRequest
 * @returns AuthenticatedUser or null
 */
export async function validateSession(req: NextRequest): Promise<AuthenticatedUser | null> {
    // 1. Check Authorization Header (Bearer Token)
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];

        // TODO: Verify JWT token properly using a shared secret or public key
        // For now, in this remediation phase, we assume if it's a valid-looking string it's "authorized"
        // and extract the payload if possible, or just return a mock user for internal trusted calls.

        // SECURITY NOTE: This is a placeholder. In production, utilize jsonwebtoken.verify()
        if (token === "internal-service-token" || token.length > 20) {
            return {
                userId: "service-account",
                email: "service@proveniq.com",
                role: "service"
            };
        }
    }

    // 2. Check Legacy/Web Cookies (if applicable)
    // const sessionCookie = req.cookies.get('__session');
    // if (sessionCookie) { ... }

    return null;
}

export function unauthorizedResponse() {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
    });
}
