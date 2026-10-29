import { randomBytes, randomUUID, scrypt } from "node:crypto";

export const DEPARTMENTS = ["Engineering", "Design", "People & Culture", "Operations", "Finance", "Sales"];
export const REQUIRED_EMPLOYEE_FIELDS = ["name", "email", "department", "salary"];

export function normalizeEmployee(input) {
  return {
    name: typeof input.name === "string" ? input.name.trim() : "",
    email: typeof input.email === "string" ? input.email.trim().toLowerCase() : "",
    department: typeof input.department === "string" ? input.department.trim() : "",
    salary: Number(input.salary),
    phone: typeof input.phone === "string" ? input.phone.trim() : "",
    address: typeof input.address === "string" ? input.address.trim() : "",
    designation: typeof input.designation === "string" ? input.designation.trim() : "",
  };
}

export function validateEmployee(input, existingEmployees = [], rowNumber = null) {
  const employee = normalizeEmployee(input);
  const errors = [];
  if (!employee.name) errors.push("name is required");
  if (!employee.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employee.email)) errors.push("email must be valid");
  if (!employee.department || !DEPARTMENTS.includes(employee.department)) errors.push(`department must be one of: ${DEPARTMENTS.join(", ")}`);
  if (!Number.isFinite(employee.salary) || employee.salary <= 0) errors.push("salary must be greater than 0");
  if (existingEmployees.some((candidate) => candidate.email.toLowerCase() === employee.email)) errors.push("email already exists");
  return { employee, errors: errors.map((reason) => ({ row: rowNumber, field: reason.split(" ")[0], reason })) };
}

export function createTemporaryPassword() {
  return `Welcome@${randomBytes(4).toString("hex")}`;
}

export function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");
    scrypt(password, salt, 64, (error, key) => {
      if (error) return reject(error);
      resolve(`${salt}:${key.toString("hex")}`);
    });
  });
}

export function createEmployeeRecord(input, userId) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    userId,
    ...input,
    createdAt: now,
    updatedAt: now,
    isActive: true,
  };
}
