// Supabase JWT authentication helper
import { supabaseAdmin } from "../db/supabase";

export async function authenticateRequest(headers: Headers): Promise<{
  isValid: boolean;
  userId?: string;
}> {
  const authHeader = headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { isValid: false };
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  if (!token) {
    return { isValid: false };
  }

  try {
    // Verify the JWT token using Supabase admin client
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return { isValid: false };
    }

    return { isValid: true, userId: user.id };
  } catch (error) {
    console.error("Error verifying JWT token:", error);
    return { isValid: false };
  }
}

export function createAuthError() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
