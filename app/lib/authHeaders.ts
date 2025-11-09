import { User, Session } from "@supabase/supabase-js";

/**
 * Generate authenticated headers for API requests
 * @param session - The authenticated Supabase session (contains JWT access_token)
 * @returns Headers object with Authorization and Content-Type
 */
export function getAuthHeaders(session: Session | null): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  return headers;
}

/**
 * Create a fetch options object with authenticated headers
 * @param session - The authenticated Supabase session
 * @param method - HTTP method (default: 'GET')
 * @param body - Request body (optional)
 * @returns RequestInit object ready for fetch
 */
export function createAuthFetchOptions(
  session: Session | null,
  method: string = "GET",
  body?: BodyInit
): RequestInit {
  const options: RequestInit = {
    method,
    headers: getAuthHeaders(session),
  };

  if (body) {
    options.body = body;
  }

  return options;
}

/**
 * Check if a user is authenticated (has a valid ID)
 * @param user - The Supabase user object
 * @returns boolean indicating if user is authenticated
 */
export function isUserAuthenticated(user: User | null): user is User {
  return user !== null && !!user.id;
}
