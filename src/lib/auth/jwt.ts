import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'modernway_civil_solution_secure_production_secret_key_2026';
const key = new TextEncoder().encode(JWT_SECRET);

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  organizationId?: string;
  role?: string;
  [key: string]: unknown;
}

export async function signJWT(payload: JWTPayload, expiresIn = '7d'): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key);
    return payload as unknown as JWTPayload;
  } catch (error) {
    return null;
  }
}
