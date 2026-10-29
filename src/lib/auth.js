import { createHmac, timingSafeEqual, scrypt, randomBytes } from "node:crypto";

const JWT_SECRET = process.env.HCM_JWT_SECRET || "development-only-change-this-secret";
const TOKEN_TTL_SECONDS = 60 * 60 * 8;

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(value) {
  return createHmac("sha256", JWT_SECRET).update(value).digest("base64url");
}

function readBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  return request.cookies.get("hcm_token")?.value || null;
}

function passwordMatches(password, storedHash) {
  return new Promise((resolve) => {
    try {
      if (!password || !storedHash) return resolve(false);
      const str = String(storedHash).trim();
      if (password === str) return resolve(true);

      const parts = str.split(":");
      if (parts.length < 2) return resolve(false);

      const salt = parts[0];
      const expectedHex = parts[1];
      if (!salt || !expectedHex) return resolve(false);

      scrypt(password, salt, 64, (error, derivedKey) => {
        if (error || !derivedKey) return resolve(false);
        try {
          const expected = Buffer.from(expectedHex, "hex");
          if (expected.length !== derivedKey.length) return resolve(false);
          return resolve(timingSafeEqual(expected, derivedKey));
        } catch {
          return resolve(false);
        }
      });
    } catch {
      return resolve(false);
    }
  });
}

export function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");
    scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) return reject(error);
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

export async function verifyPassword(password, storedHash) {
  return passwordMatches(password, storedHash);
}

export function createToken({ userId, role, employeeId = null, name = "", email = "" }) {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    userId,
    role,
    employeeId,
    name,
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }));
  const unsignedToken = `${header}.${payload}`;
  return `${unsignedToken}.${sign(unsignedToken)}`;
}

function decodeToken(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed token.");
  const unsignedToken = `${parts[0]}.${parts[1]}`;
  const expectedSignature = sign(unsignedToken);
  const receivedSignature = Buffer.from(parts[2], "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (receivedSignature.length !== expected.length || !timingSafeEqual(receivedSignature, expected)) throw new Error("Invalid token signature.");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) throw new Error("Token expired.");
  return payload;
}

export async function authenticate(request, allowedRoles = []) {
  const token = readBearerToken(request);
  if (!token) return { ok: false, error: "Authentication required.", status: 401 };

  try {
    const user = decodeToken(token);
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return { ok: false, error: "You do not have permission for this resource.", status: 403 };
    }
    return { ok: true, user };
  } catch {
    return { ok: false, error: "Invalid or expired authentication token.", status: 401 };
  }
}
