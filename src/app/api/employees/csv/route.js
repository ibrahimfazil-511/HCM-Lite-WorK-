import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authenticate } from "../../../../lib/auth.js";
import { createEmployeeRecord, createTemporaryPassword, hashPassword, validateEmployee, DEPARTMENTS } from "../../../../lib/employees.js";
import { readStore, writeStore } from "../../../../lib/store.js";

function authResponse(auth) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}

function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

export async function GET(request) {
  const auth = await authenticate(request, ["ADMIN", "HR"]);
  if (!auth.ok) return authResponse(auth);

  const store = await readStore();
  const employees = store.employees || [];

  const headers = ["Name", "Email", "Department", "Designation", "Salary", "Phone", "Address"];
  const rows = employees.map((e) => [
    `"${(e.name || "").replace(/"/g, '""')}"`,
    `"${e.email || ""}"`,
    `"${e.department || ""}"`,
    `"${e.designation || ""}"`,
    e.salary || 0,
    `"${e.phone || ""}"`,
    `"${(e.address || "").replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="employees-export.csv"',
    },
  });
}

export async function POST(request) {
  const auth = await authenticate(request, ["ADMIN", "HR"]);
  if (!auth.ok) return authResponse(auth);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const { csvText, dryRun = true } = payload;
  if (!csvText || typeof csvText !== "string") {
    return NextResponse.json({ error: "csvText string is required." }, { status: 400 });
  }

  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV must contain at least a header and 1 data row." }, { status: 422 });
  }

  const headerLine = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const nameIdx = headerLine.indexOf("name");
  const emailIdx = headerLine.indexOf("email");
  const deptIdx = headerLine.indexOf("department");
  const salaryIdx = headerLine.indexOf("salary");
  const desigIdx = headerLine.indexOf("designation");
  const phoneIdx = headerLine.indexOf("phone");
  const addrIdx = headerLine.indexOf("address");

  if (nameIdx === -1 || emailIdx === -1 || deptIdx === -1 || salaryIdx === -1) {
    return NextResponse.json({
      error: "CSV header must include: Name, Email, Department, Salary.",
      availableDepartments: DEPARTMENTS,
    }, { status: 422 });
  }

  const store = await readStore();
  const existingEmployees = [...(store.employees || [])];
  const allErrors = [];
  const validRecords = [];

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1;
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 4) continue;

    const rowObj = {
      name: cols[nameIdx] || "",
      email: cols[emailIdx] || "",
      department: cols[deptIdx] || "",
      salary: cols[salaryIdx] || "",
      designation: desigIdx !== -1 ? cols[desigIdx] : "Employee",
      phone: phoneIdx !== -1 ? cols[phoneIdx] : "",
      address: addrIdx !== -1 ? cols[addrIdx] : "",
    };

    const validation = validateEmployee(rowObj, existingEmployees, rowNumber);
    if (validation.errors.length) {
      allErrors.push(...validation.errors);
    } else {
      validRecords.push(validation.employee);
      // Prevent duplicate within the same CSV batch
      existingEmployees.push(validation.employee);
    }
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      totalRows: lines.length - 1,
      validCount: validRecords.length,
      errorCount: allErrors.length,
      errors: allErrors,
      sampleValid: validRecords.slice(0, 3),
    });
  }

  // Commit valid rows
  if (allErrors.length > 0) {
    return NextResponse.json({
      error: "Cannot commit import while errors exist in CSV. Fix errors and retry.",
      errors: allErrors,
    }, { status: 422 });
  }

  const newEmployees = [];
  const newUsers = [];
  const generatedLogins = [];

  for (const empInput of validRecords) {
    const temporaryPassword = createTemporaryPassword();
    const userId = randomUUID();
    const employee = createEmployeeRecord(empInput, userId);
    const passwordHash = await hashPassword(temporaryPassword);

    const user = {
      id: userId,
      name: employee.name,
      email: employee.email,
      passwordHash,
      role: "EMPLOYEE",
      employeeId: employee.id,
      mustChangePassword: true,
      isTempPassword: true,
      isActive: true,
      createdAt: employee.createdAt,
    };

    newEmployees.push(employee);
    newUsers.push(user);
    generatedLogins.push({ email: employee.email, temporaryPassword });
  }

  await writeStore({
    ...store,
    employees: [...(store.employees || []), ...newEmployees],
    users: [...(store.users || []), ...newUsers],
  });

  return NextResponse.json({
    dryRun: false,
    importedCount: newEmployees.length,
    generatedLogins,
  }, { status: 201 });
}
