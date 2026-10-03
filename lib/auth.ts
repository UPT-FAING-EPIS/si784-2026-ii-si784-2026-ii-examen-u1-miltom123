/**
 * Sistema de Apuestas a Eventos Deportivos en Línea
 * Autor: Milton H Flores Chino
 * Utilidades de Autenticación y Criptografía (JWT + Bcrypt)
 */

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { User } from "./types";

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32)
    throw new Error("Configure JWT_SECRET con al menos 32 caracteres");
  return value;
}

export interface TokenPayload {
  userId: string;
  name: string;
  email: string;
  role: "admin" | "bettor";
}

export function generateToken(user: User): string {
  const payload: TokenPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, secret(), {
    expiresIn: "8h",
    algorithm: "HS256",
    issuer: "betsport",
    audience: "betsport",
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret(), {
      algorithms: ["HS256"],
      issuer: "betsport",
      audience: "betsport",
    }) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function extractTokenFromHeader(
  authHeader?: string | null,
): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7).trim();
}
