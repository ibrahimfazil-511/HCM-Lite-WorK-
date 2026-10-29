import { randomUUID, randomBytes, scrypt } from "node:crypto";
import { NextResponse } from "next/server";
import { readStore, writeStore } from "../../../lib/store";

function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");
    scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

export async function GET() {
  const store = await readStore();
  return NextResponse.json({
    configured: Boolean(store.configured && store.company && store.users.some((user) => user.role === "ADMIN")),
    company: store.company || null,
    office: store.office || null,
  });
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  }

  const {
    companyName,
    companyEmail,
    officeStart = "09:00",
    graceMinutes = 15,
    radiusMeters = 150,
    latitude,
    longitude,
    adminName,
    adminEmail,
    adminPassword,
  } = payload;

  if (!companyName || !isValidEmail(companyEmail) || !adminName || !isValidEmail(adminEmail) || !adminPassword) {
    return NextResponse.json({ error: "Company, valid emails, admin name, and password are required." }, { status: 400 });
  }
  if (adminPassword.length < 8) {
    return NextResponse.json({ error: "Admin password must be at least 8 characters." }, { status: 400 });
  }
  if (!/^\d{2}:\d{2}$/.test(officeStart) || !Number.isInteger(Number(graceMinutes)) || Number(graceMinutes) < 0 || !Number.isInteger(Number(radiusMeters)) || Number(radiusMeters) <= 0 || !isFiniteNumber(Number(latitude)) || !isFiniteNumber(Number(longitude))) {
    return NextResponse.json({ error: "Office settings must contain valid time, radius, and coordinates." }, { status: 400 });
  }

  const currentStore = await readStore();
  if (currentStore.configured) {
    return NextResponse.json({ error: "System is already configured." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const adminId = randomUUID();
  const passwordHash = await hashPassword(adminPassword);
  const store = {
    configured: true,
    company: { id: randomUUID(), name: companyName.trim(), email: companyEmail.trim().toLowerCase() },
    office: {
      startTime: officeStart,
      graceMinutes: Number(graceMinutes),
      radiusMeters: Number(radiusMeters),
      latitude: Number(latitude),
      longitude: Number(longitude),
    },
    users: [{
      id: adminId,
      name: adminName.trim(),
      email: adminEmail.trim().toLowerCase(),
      passwordHash,
      role: "ADMIN",
      isActive: true,
      createdAt: now,
    }],
    auditLogs: [{ id: randomUUID(), actorId: adminId, action: "SYSTEM_SETUP", createdAt: now }],
  };

  await writeStore(store);
  return NextResponse.json({ configured: true, redirectTo: "/login" }, { status: 201 });
}
