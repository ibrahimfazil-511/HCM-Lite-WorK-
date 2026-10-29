import { NextResponse } from "next/server";
import { authenticate } from "../../../../../lib/auth";
import { readStore } from "../../../../../lib/store";

export async function GET(request, { params }) {
  const auth = await authenticate(request, ["ADMIN", "HR", "EMPLOYEE"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const store = await readStore();
  const payroll = (store.payrolls || []).find((candidate) => candidate.id === id);
  if (!payroll) return NextResponse.json({ error: "Payroll not found." }, { status: 404 });

  const employeeId = new URL(request.url).searchParams.get("employeeId") || auth.user.employeeId;
  const line = payroll.lines.find((candidate) => candidate.employeeId === employeeId);
  if (!line) return NextResponse.json({ error: "Payslip not found." }, { status: 404 });

  if (auth.user.role === "EMPLOYEE" && employeeId !== auth.user.employeeId) {
    return NextResponse.json({ error: "You cannot access this payslip." }, { status: 403 });
  }

  const format = new URL(request.url).searchParams.get("format");
  if (format === "download") {
    const body = [
      `=============================================`,
      `          HCM Lite - OFFICIAL PAYSLIP        `,
      `=============================================`,
      `Month:                 ${line.month}`,
      `Employee:              ${line.employeeName}`,
      `Department:            ${line.department}`,
      `Working Days:          ${line.workingDays}`,
      `Present Days:          ${line.presentDays}`,
      `---------------------------------------------`,
      `EARNINGS:`,
      `  Basic Salary:        ${line.basic.toFixed(2)} PKR`,
      `  Overtime (${line.totalOvertimeHours || 0} hrs): +${(line.overtimePay || 0).toFixed(2)} PKR`,
      `  Gross Earnings:      ${line.gross.toFixed(2)} PKR`,
      `---------------------------------------------`,
      `DEDUCTIONS:`,
      `  Late Arrivals (${line.lateDays || 0}): -${(line.lateDeduction || 0).toFixed(2)} PKR`,
      `  Absent Days (${line.absentDays || 0}):   -${(line.absentDeduction || 0).toFixed(2)} PKR`,
      `  Income Tax:          -${(line.tax || 0).toFixed(2)} PKR`,
      `  Total Deductions:    -${(line.totalDeductions || 0).toFixed(2)} PKR`,
      `---------------------------------------------`,
      `NET PAYABLE SALARY:    ${line.netPay.toFixed(2)} PKR`,
      `=============================================`,
      `Payroll Status:        ${payroll.status.toUpperCase()}`,
      `Generated At:          ${line.generatedAt || new Date().toISOString()}`,
    ].join("\n");

    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="payslip-${line.month}-${line.employeeId}.txt"`,
      },
    });
  }

  return NextResponse.json({
    payroll: { id: payroll.id, month: payroll.month, status: payroll.status },
    payslip: line,
  });
}
