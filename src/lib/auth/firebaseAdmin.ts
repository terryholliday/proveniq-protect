/**
 * PROVENIQ — Firebase Admin Initialization (server-only)
 */
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

export function getFirebaseAdminApp(): App {
  if (getApps().length) return getApps()[0]!;
  const projectId = requiredEnv("FIREBASE_PROJECT_ID");
  const clientEmail = requiredEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = requiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export async function verifyFirebaseBearerToken(bearerToken: string) {
  getFirebaseAdminApp();
  const auth = getAuth();
  return await auth.verifyIdToken(bearerToken, true);
}
