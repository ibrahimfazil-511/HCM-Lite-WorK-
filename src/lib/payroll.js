import { randomUUID } from "node:crypto";
import { calculateLateHours, getEarlyMinutes, getLateMinutes, getOvertimeMinutes } from "./attendance.js";

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
  return { start, end: `${month}-${String(lastDay).padStart(2, "0")}`, lastDay };
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

/**
 * Generate 30-Day Day-by-Day Monthly Register Table for an employee.
 * Shows Date, Day, Status, Check-in, Check-out, Duty Hours, Late Hours, Late Cut, Overtime, Absent Cut, and Net Earned.
 * Future dates are strictly marked as "upcoming" with 0 deduction!
 * Partial/short duty (e.g. 4 mins) is paid strictly for exact time worked.
 */
export function generateMonthly30DayRecord(employee, month, store) {
  const basic = Number(employee.salary) || 0;
  const perDayRate = roundMoney(basic / 30);
  const hourlyRate = roundMoney(perDayRate / 8);
  const overtimeRate = roundMoney(hourlyRate * 1.5);

  const todayStr = new Date().toISOString().slice(0, 10);

  const attendance = (store.attendance || []).filter(
    (record) => record.employeeId === employee.id && String(record.date || "").startsWith(`${month}-`)
  );
  const attendanceByDate = new Map(attendance.map((record) => [record.date, record]));

  const approvedLeaves = (store.leaves || []).filter(
    (leave) => leave.employeeId === employee.id && String(leave.status).toLowerCase() === "approved"
  );

  const days = [];
  for (let i = 1; i <= 30; i++) {
    const dayStr = String(i).padStart(2, "0");
    const dateStr = `${month}-${dayStr}`;
    const dateObj = new Date(`${dateStr}T12:00:00Z`);
    const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dateObj.getUTCDay()];

    const isFuture = dateStr > todayStr;
    const isToday = dateStr === todayStr;

    const record = attendanceByDate.get(dateStr);
    const leave = approvedLeaves.find((l) => dateStr >= l.startDate && dateStr <= l.endDate);

    let status = "absent";
    let statusLabel = "Absent (Cut)";
    let dutyHours = 0;
    let lateMinutes = 0;
    let lateHours = 0;
    let lateCut = 0;
    let earlyMinutes = 0;
    let earlyHours = 0;
    let earlyCut = 0;
    let overtimeHours = 0;
    let overtimePay = 0;
    let absentCut = 0;
    let dayNet = 0;

    if (record) {
      dutyHours = Number(record.totalWorkHours || 0);

      // Overtime starts after the configured office end time.
      const ot = record.checkOutAt
        ? getOvertimeMinutes(record.checkOutAt, store.office) / 60
        : Number(record.overtimeHours || 0);
      overtimeHours = ot > 0 ? Number(ot.toFixed(2)) : 0;
      overtimePay = roundMoney(overtimeHours * overtimeRate);

      if (record.checkInAt) {
        lateMinutes = getLateMinutes(record.checkInAt, store.office);
        lateHours = Number((lateMinutes / 60).toFixed(2));
        lateCut = roundMoney(lateHours * hourlyRate);
      }

      if (record.checkOutAt) {
        earlyMinutes = getEarlyMinutes(record.checkOutAt, store.office);
        earlyHours = Number((earlyMinutes / 60).toFixed(2));
        earlyCut = roundMoney(earlyHours * hourlyRate);
      }

      if (dutyHours >= 8.0 || record.checkOutAt) {
        // Full duty completed
        status = lateHours > 0 ? "late" : "present";
        statusLabel = lateHours > 0 ? "Present (Late)" : "Full Duty (8h)";
        dayNet = roundMoney(Math.max(0, perDayRate - lateCut - earlyCut + overtimePay));
      } else if (dutyHours > 0) {
        // Partial/Short duty: Pay strictly according to exact hours/minutes worked!
        // "jaise 4 mint ki duty kari hai 4 mint ke paise milte"
        const exactMinutes = Math.round(dutyHours * 60);
        status = "partial";
        statusLabel = exactMinutes < 60 ? `Duty: ${exactMinutes} mins` : `Duty: ${dutyHours.toFixed(2)} hrs`;
        const dutyEarned = roundMoney(dutyHours * hourlyRate);
        dayNet = roundMoney(Math.max(0, dutyEarned - lateCut));
        // Shortage cut for the remaining hours of the 8-hour day
        const shortageHours = Math.max(0, 8 - dutyHours);
        absentCut = roundMoney(shortageHours * hourlyRate);
      } else {
        // Checked in but 0 duty logged
        status = "absent";
        statusLabel = "0 hrs duty";
        absentCut = perDayRate;
        dayNet = 0;
      }
    } else if (leave) {
      status = "unpaid_leave";
      statusLabel = `Leave (${leave.leaveType || "approved"})`;
      absentCut = perDayRate;
      dayNet = 0;
    } else if (isFuture) {
      // Future date that hasn't arrived yet! Do NOT mark absent, do NOT deduct!
      status = "upcoming";
      statusLabel = "Upcoming";
      dutyHours = 0;
      absentCut = 0;
      dayNet = 0;
    } else if (isToday) {
      // Today, not checked in yet
      status = "pending_today";
      statusLabel = "Pending Today";
      dutyHours = 0;
      absentCut = 0;
      dayNet = 0;
    } else {
      // Past day in the month where employee was absent
      status = "absent";
      statusLabel = "Absent (Cut)";
      absentCut = perDayRate;
      dayNet = 0;
    }

    days.push({
      day: i,
      date: dateStr,
      dayOfWeek,
      status,
      statusLabel,
      checkInAt: record?.checkInAt || null,
      checkOutAt: record?.checkOutAt || null,
      dutyHours: Number(dutyHours.toFixed(2)),
      lateHours,
      lateMinutes,
      lateCut,
      earlyHours,
      earlyMinutes,
      earlyCut,
      overtimeHours,
      overtimePay,
      absentCut,
      dayEarned: dayNet,
      isUpcoming: isFuture,
    });
  }

  return days;
}

export function calculatePayrollForEmployee(employee, month, store) {
  const range = monthRange(month);
  if (!range) throw new Error("Payroll month must use YYYY-MM format.");

  // Standard 30 Working Days per month as required
  const workingDaysCount = 30;

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7);
  const todayDayNum = new Date().getDate();

  // Elapsed calendar days in this month:
  // If current month: only days 1 to today have occurred!
  // If future month: 0 days have occurred!
  // If past month: all 30 days have occurred!
  let elapsedDays = 30;
  if (month === currentMonthStr) {
    elapsedDays = Math.min(30, todayDayNum);
  } else if (month > currentMonthStr) {
    elapsedDays = 0;
  }

  // Rate calculations strictly based on Basic Salary:
  const basic = Number(employee.salary) || 0;
  const perDayRate = roundMoney(basic / 30); // 1 Day Salary = Basic / 30
  const hourlyRate = roundMoney(perDayRate / 8); // 1 Hour Salary = Daily / 8
  const overtimeRate = roundMoney(hourlyRate * 1.5); // 1.5x Overtime Rate

  // Generate full 30-day day-by-day record
  const monthlyRecords = generateMonthly30DayRecord(employee, month, store);

  // Calculate metrics from the 30-day records
  let presentDays = 0;
  let lateDays = 0;
  let totalLateHours = 0;
  let totalLateMinutes = 0;
  let totalWorkHours = 0;
  let totalOvertimeHours = 0;
  let overtimePay = 0;
  let lateDeduction = 0;
  let earlyDeduction = 0;
  let absentDays = 0;
  let absentDeduction = 0;
  let totalDayEarnings = 0;
  let unpaidLeaveDays = 0;

  for (const day of monthlyRecords) {
    if (day.isUpcoming) continue; // Skip future dates!

    if (day.status === "present" || day.status === "late") {
      presentDays += 1;
      totalWorkHours += day.dutyHours;
      if (day.status === "late") {
        lateDays += 1;
        totalLateHours += day.lateHours;
        totalLateMinutes += day.lateMinutes;
        lateDeduction += day.lateCut;
      }
      earlyDeduction += day.earlyCut;
      totalOvertimeHours += day.overtimeHours;
      overtimePay += day.overtimePay;
      totalDayEarnings += day.dayEarned;
    } else if (day.status === "partial") {
      // Partial duty day (e.g. 4 minutes or few hours)
      presentDays += 1;
      totalWorkHours += day.dutyHours;
      if (day.lateHours > 0) {
        lateDays += 1;
        totalLateHours += day.lateHours;
        totalLateMinutes += day.lateMinutes;
        lateDeduction += day.lateCut;
      }
      earlyDeduction += day.earlyCut;
      absentDeduction += day.absentCut;
      totalDayEarnings += day.dayEarned;
    } else if (day.status === "unpaid_leave") {
      unpaidLeaveDays += 1;
      absentDays += 1;
      absentDeduction += day.absentCut;
    } else if (day.status === "absent") {
      absentDays += 1;
      absentDeduction += day.absentCut;
    }
  }

  totalLateHours = Number(totalLateHours.toFixed(2));
  totalLateMinutes = Math.round(totalLateMinutes);
  totalWorkHours = Number(totalWorkHours.toFixed(2));
  totalOvertimeHours = Number(totalOvertimeHours.toFixed(2));
  overtimePay = roundMoney(overtimePay);
  lateDeduction = roundMoney(lateDeduction);
  earlyDeduction = roundMoney(earlyDeduction);
  absentDeduction = roundMoney(absentDeduction);

  const totalDeductions = roundMoney(absentDeduction + lateDeduction + earlyDeduction);

  let netPay = 0;
  let gross = 0;

  if (month < currentMonthStr) {
    // Past completed month: Gross = Basic + Overtime, Net = Gross - Deductions
    gross = roundMoney(basic + overtimePay);
    netPay = roundMoney(Math.max(0, gross - totalDeductions));
  } else if (month === currentMonthStr) {
    // Current month: only completed attendance records earn salary.
    // Absent, leave, pending, and future days must not receive accrued pay.
    netPay = roundMoney(Math.max(0, totalDayEarnings));
    gross = roundMoney(netPay + totalDeductions);
  } else {
    gross = 0;
    netPay = 0;
  }

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    department: employee.department,
    designation: employee.designation || "Staff",
    month,
    basic: roundMoney(basic),
    workingDays: workingDaysCount, // 30 Days Standard Month
    elapsedDays,
    perDayRate,
    hourlyRate,
    overtimeRate,
    presentDays,
    approvedPaidLeaves: 0,
    leaveDays: unpaidLeaveDays,
    unpaidLeaveDays,
    absentDays,
    halfDays: 0,
    lateDays,
    totalLateHours,
    totalLateMinutes,
    lateRate: hourlyRate, // hourly rate cut per late hour
    lateDeduction,
    earlyDeduction,
    absentDeduction,
    totalWorkHours,
    totalOvertimeHours,
    overtimePay,
    deductions: totalDeductions,
    tax: 0, // FBR Tax removed
    totalDeductions,
    gross,
    netPay,
    monthlyRecords,
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
      earlyDeduction: result.earlyDeduction + line.earlyDeduction,
      absentDeduction: result.absentDeduction + line.absentDeduction,
      gross: result.gross + line.gross,
      deductions: result.deductions + line.totalDeductions,
      tax: 0,
      netPay: result.netPay + line.netPay,
    }),
    { basic: 0, overtimePay: 0, lateDeduction: 0, earlyDeduction: 0, absentDeduction: 0, gross: 0, deductions: 0, tax: 0, netPay: 0 }
  );

  return {
    id: randomUUID(),
    month,
    status: "draft",
    createdAt: new Date().toISOString(),
    createdBy: actorId,
    lines,
    totals,
  };
}
