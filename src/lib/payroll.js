import { randomUUID } from "node:crypto";
import { getWorkingDates } from "./leaves.js";

export const TAX_BRACKETS = [
  { limit: 600000, base: 0, rate: 0 },
  { limit: 1200000, base: 0, rate: 0.05 },
  { limit: 2400000, base: 30000, rate: 0.15 },
  { limit: 3600000, base: 210000, rate: 0.25 },
  { limit: Infinity, base: 510000, rate: 0.35 },
];

export function isValidPayrollMonth(month) {
  return typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month.trim());
}

function monthParts(month) {
  if (!isValidPayrollMonth(month)) return null;
  const [year, monthNumber] = month.split("-").map(Number);
  return { year, monthNumber };
}

function monthRange(month) {
  const parts = monthParts(month);
  if (!parts) return null;
  const start = `${month}-01`;
  const lastDay = new Date(Date.UTC(parts.year, parts.monthNumber, 0)).getUTCDate();
  return { start, end: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function calculateAnnualTax(annualGross) {
  const bracket = TAX_BRACKETS.find((candidate) => annualGross <= candidate.limit) || TAX_BRACKETS[TAX_BRACKETS.length - 1];
  if (bracket.rate === 0) return 0;
  const lowerLimit = bracket === TAX_BRACKETS[0] ? 0 : TAX_BRACKETS[TAX_BRACKETS.indexOf(bracket) - 1].limit;
  return bracket.base + (annualGross - lowerLimit) * bracket.rate;
}

export function calculatePayrollForEmployee(employee, month, store) {
  const range = monthRange(month);
  if (!range) throw new Error("Payroll month must use YYYY-MM format.");

  const workingDates = getWorkingDates(range.start, range.end, store.publicHolidays || []);
  const workingDaysCount = workingDates.length || 22;

  // Filter attendance for this employee in this month
  const attendance = (store.attendance || []).filter(
    (record) => record.employeeId === employee.id && String(record.date || "").startsWith(`${month}-`)
  );
  const attendanceByDate = new Map(attendance.map((record) => [record.date, record]));

  // Approved and Unpaid leaves
  const approvedLeaves = (store.leaves || []).filter(
    (leave) => leave.employeeId === employee.id && String(leave.status).toLowerCase() === "approved"
  );
  const approvedLeaveDates = new Set();
  const unpaidLeaveDates = new Set();
  for (const leave of approvedLeaves) {
    for (const date of getWorkingDates(leave.startDate, leave.endDate, store.publicHolidays || [])) {
      if (date.startsWith(`${month}-`)) {
        approvedLeaveDates.add(date);
        if (String(leave.leaveType).toLowerCase() === "unpaid") unpaidLeaveDates.add(date);
      }
    }
  }

  // Calculate days
  const absentDates = workingDates.filter((date) => !attendanceByDate.has(date) && !approvedLeaveDates.has(date));
  const halfDayDates = workingDates.filter((date) => attendanceByDate.get(date)?.status === "half_day");
  const lateAttendance = attendance.filter((record) => record.status === "late" || record.isLate);

  // Rate calculations
  const basic = Number(employee.salary) || 0;
  const perDayRate = workingDaysCount ? basic / workingDaysCount : 0;
  const hourlyRate = perDayRate / 8; // standard 8 hours duty per day

  // Overtime Calculation: any hours worked beyond 8 hours/day
  let totalWorkHours = 0;
  let totalOvertimeHours = 0;
  for (const record of attendance) {
    const hours = Number(record.totalWorkHours || 0);
    totalWorkHours += hours;
    const ot = Number(record.overtimeHours || (hours > 8 ? hours - 8 : 0));
    totalOvertimeHours += ot;
  }

  const overtimeRate = hourlyRate * 1.5; // 1.5x overtime multiplier
  const overtimePay = roundMoney(totalOvertimeHours * overtimeRate);

  // Deductions:
  // 1. Absent days = full day deduction
  // 2. Half days = 0.5 day deduction
  // 3. Unpaid leaves = full day deduction
  // 4. Late arrivals = 0.5 hour salary deduction per late arrival
  const absentDeduction = roundMoney(absentDates.length * perDayRate);
  const halfDayDeduction = roundMoney(halfDayDates.length * (perDayRate * 0.5));
  const unpaidLeaveDeduction = roundMoney(unpaidLeaveDates.size * perDayRate);
  const totalAbsentDeduction = roundMoney(absentDeduction + halfDayDeduction + unpaidLeaveDeduction);

  const lateDeduction = roundMoney(lateAttendance.length * (hourlyRate * 0.5));
  const totalDeductionsExcludingTax = roundMoney(totalAbsentDeduction + lateDeduction);

  // Gross = Basic + Overtime Pay
  const gross = roundMoney(basic + overtimePay);

  // Tax on annual gross
  const annualTax = calculateAnnualTax(gross * 12);
  const monthlyTax = roundMoney(annualTax / 12);

  const totalDeductions = roundMoney(totalDeductionsExcludingTax + monthlyTax);
  const netPay = roundMoney(Math.max(0, gross - totalDeductions));

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    department: employee.department,
    month,
    basic: roundMoney(basic),
    hourlyRate: roundMoney(hourlyRate),
    perDayRate: roundMoney(perDayRate),
    workingDays: workingDaysCount,
    presentDays: attendance.filter((r) => ["present", "late"].includes(r.status)).length,
    absentDays: absentDates.length,
    lateDays: lateAttendance.length,
    halfDays: halfDayDates.length,
    unpaidLeaveDays: unpaidLeaveDates.size,
    totalWorkHours: roundMoney(totalWorkHours),
    totalOvertimeHours: roundMoney(totalOvertimeHours),
    overtimePay,
    lateDeduction,
    absentDeduction: totalAbsentDeduction,
    deductions: totalDeductionsExcludingTax,
    tax: monthlyTax,
    totalDeductions,
    gross,
    netPay,
    generatedAt: new Date().toISOString(),
  };
}

export function createPayrollDraft(month, store, actorId) {
  if (!monthParts(month)) throw new Error("Payroll month must use YYYY-MM format.");
  const employees = (store.employees || []).filter((employee) => employee.isActive !== false);
  const lines = employees.map((employee) => calculatePayrollForEmployee(employee, month, store));
  const totals = lines.reduce(
    (result, line) => ({
      basic: result.basic + line.basic,
      overtimePay: result.overtimePay + line.overtimePay,
      lateDeduction: result.lateDeduction + line.lateDeduction,
      absentDeduction: result.absentDeduction + line.absentDeduction,
      gross: result.gross + line.gross,
      deductions: result.deductions + line.totalDeductions,
      tax: result.tax + line.tax,
      netPay: result.netPay + line.netPay,
    }),
    { basic: 0, overtimePay: 0, lateDeduction: 0, absentDeduction: 0, gross: 0, deductions: 0, tax: 0, netPay: 0 }
  );

  return {
    id: randomUUID(),
    month,
    status: "draft",
    lines,
    totals: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, roundMoney(value)])),
    createdAt: new Date().toISOString(),
    createdBy: actorId || null,
  };
}
