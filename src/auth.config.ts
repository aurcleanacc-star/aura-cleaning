import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe slice of the auth configuration. It deliberately contains no
 * database or Node-only imports so that it can power the middleware.
 */
export const authConfig = {
  secret:
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "aurclean_production_fallback_secret_key_change_me",
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 12,
  },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
