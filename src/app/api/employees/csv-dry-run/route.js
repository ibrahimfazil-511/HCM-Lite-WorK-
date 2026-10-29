import { NextResponse } from "next/server";
import { authenticate } from "../../../../lib/auth";
import { REQUIRED_EMPLOYEE_FIELDS, validateEmployee } from "../../../../lib/employees";
import { readStore } from "../../../../lib/store";

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",");
    return headers.reduce((record, header, index) => ({ ...record, [header]: (values[index] || "").trim() }), {});
  });
  return { headers, rows };
}

export async function POST(request) {
  const auth = await authenticate(request, ["ADMIN", "HR"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let text;
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await request.json();
    text = body.csv;
  } else {
    text = await request.text();
  }
  if (typeof text !== "string" || !text.trim()) return NextResponse.json({ error: "CSV content is required." }, { status: 400 });
  const { headers, rows } = parseCsv(text);
  const missingFields = REQUIRED_EMPLOYEE_FIELDS.filter((field) => !headers.includes(field));
  if (missingFields.length) return NextResponse.json({ dryRun: true, validRows: [], errors: [{ row: 1, field: "headers", reason: `Missing required fields: ${missingFields.join(", ")}` }] }, { status: 422 });
  const store = await readStore();
  const validRows = [];
  const errors = [];
  const seenEmails = new Set((store.employees || []).map((employee) => employee.email.toLowerCase()));
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const result = validateEmployee(row, [...(store.employees || []), ...validRows.map((employee) => ({ email: employee.email }))], rowNumber);
    const duplicateInFile = seenEmails.has(String(row.email || "").trim().toLowerCase());
    if (duplicateInFile && !result.errors.some((error) => error.reason === "email already exists")) result.errors.push({ row: rowNumber, field: "email", reason: "email already exists" });
    if (result.errors.length) errors.push(...result.errors);
    else { validRows.push(result.employee); seenEmails.add(result.employee.email); }
  });
  return NextResponse.json({ dryRun: true, validRows, errors });
}
