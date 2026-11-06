import { NextResponse } from "next/server";
import { authenticate } from "../../../../../lib/auth";
import { createPayrollDraft } from "../../../../../lib/payroll";
import { readStore } from "../../../../../lib/store";

export async function GET(request, { params }) {
  const auth = await authenticate(request, ["ADMIN", "HR", "EMPLOYEE"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const store = await readStore();
  const payroll = (store.payrolls || []).find((candidate) => candidate.id === id);
  if (!payroll) return NextResponse.json({ error: "Payroll not found." }, { status: 404 });
  const effectivePayroll = {
    ...createPayrollDraft(payroll.month, store, payroll.createdBy),
    id: payroll.id,
    status: payroll.status,
    createdAt: payroll.createdAt,
  };

  const employeeId = new URL(request.url).searchParams.get("employeeId") || auth.user.employeeId;
  const line = effectivePayroll.lines.find((candidate) => candidate.employeeId === employeeId);
  if (!line) return NextResponse.json({ error: "Payslip not found." }, { status: 404 });

  if (auth.user.role === "EMPLOYEE" && employeeId !== auth.user.employeeId) {
    return NextResponse.json({ error: "You cannot access this payslip." }, { status: 403 });
  }

  const format = new URL(request.url).searchParams.get("format");
  if (format === "download") {
    const dailyRate = Number(line.perDayRate || (line.basic || 0) / 30);
    const hourlyRate = Number(line.hourlyRate || dailyRate / 8);

    const body = [
      `=============================================================`,
      `                 HCM Lite - OFFICIAL PAYSLIP                `,
      `=============================================================`,
      `Month:                 ${line.month}`,
      `Employee Name:         ${line.employeeName}`,
      `Department:            ${line.department}`,
      `Working Days:          30 Days (Standard Monthly Base)`,
      `Present Days:          ${line.presentDays || 0} days`,
      `Leave Days Deduction:  ${line.leaveDays || 0} days @ ${(line.basic / 30 || 0).toLocaleString()} PKR/day`,
      `Unpaid / Absent Days:  ${line.absentDays || 0} days`,
      `Late Arrivals:         ${line.lateDays || 0} days (${line.totalLateHours || 0} hrs late)`,
      `-------------------------------------------------------------`,
      `BASE SALARY & RATES (Calculated on 30 Days Base):`,
      `  Basic Salary:        ${(line.basic || 0).toLocaleString()} PKR`,
      `  Daily Rate (Base/30):${dailyRate.toFixed(2)} PKR / day`,
      `  Hourly Rate (Day/8): ${hourlyRate.toFixed(2)} PKR / hour`,
      `-------------------------------------------------------------`,
      `EARNINGS (+):`,
      `  Basic Base Pay:      +${(line.basic || 0).toLocaleString()} PKR`,
      `  Overtime Pay:        +${(line.overtimePay || 0).toLocaleString()} PKR (${line.totalOvertimeHours || 0} hrs @ 1.5× hourly)`,
      `  Total Gross Pay:     ${(line.gross || 0).toLocaleString()} PKR`,
      `-------------------------------------------------------------`,
      `DEDUCTIONS (-):`,
      `  Absent/Leave Cuts:   -${(line.absentDeduction || 0).toLocaleString()} PKR (${line.absentDays || 0} days @ Daily Rate)`,
      `  Late Arrival Cuts:   -${(line.lateDeduction || 0).toLocaleString()} PKR (${line.totalLateHours || 0} hrs late @ Hourly Rate)`,
      `  Total Deductions:    -${(line.totalDeductions || line.deductions || 0).toLocaleString()} PKR`,
      `=============================================================`,
      `TOTAL PAYABLE AMOUNT (NET SALARY): ${(line.netPay || 0).toLocaleString()} PKR`,
      `=============================================================`,
      `Payroll Status:        ${effectivePayroll.status.toUpperCase()}`,
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
    payroll: { id: effectivePayroll.id, month: effectivePayroll.month, status: effectivePayroll.status },
    payslip: line,
  });
}
