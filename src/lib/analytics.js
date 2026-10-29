import { getWorkingDates, LEAVE_QUOTAS, normalizeLeaveType } from "./leaves.js";

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function resolveDateRange(dateRange, customStart, customEnd, now = new Date()) {
  const todayStr = dateKey(now);
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth(); // 0-indexed

  if (customStart && customEnd && parseDate(customStart) && parseDate(customEnd) && customStart <= customEnd) {
    return { startDate: customStart, endDate: customEnd, key: "custom" };
  }

  const range = (dateRange || "this_month").toLowerCase();

  if (range === "today") {
    return { startDate: todayStr, endDate: todayStr, key: "today" };
  }

  if (range === "this_week") {
    const dayOfWeek = now.getUTCDay(); // 0 = Sun, 1 = Mon ...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(Date.UTC(currentYear, currentMonth, now.getUTCDate() + diffToMonday));
    const sunday = new Date(Date.UTC(currentYear, currentMonth, monday.getUTCDate() + 6));
    return {
      startDate: dateKey(monday),
      endDate: dateKey(sunday),
      key: "this_week",
    };
  }

  if (range === "last_month") {
    const firstDay = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
    const lastDay = new Date(Date.UTC(currentYear, currentMonth, 0));
    return {
      startDate: dateKey(firstDay),
      endDate: dateKey(lastDay),
      key: "last_month",
    };
  }

  // Default: "this_month"
  const firstDay = new Date(Date.UTC(currentYear, currentMonth, 1));
  const lastDay = new Date(Date.UTC(currentYear, currentMonth + 1, 0));
  return {
    startDate: dateKey(firstDay),
    endDate: dateKey(lastDay),
    key: "this_month",
  };
}

export function calculateAttendanceRate(employees, attendance, leaves, workingDates, publicHolidays = []) {
  if (!employees.length || !workingDates.length) return 0;

  const employeeIds = new Set(employees.map((employee) => employee.id));
  const workingDatesSet = new Set(workingDates);

  // 1. Calculate on_leave days in the period
  let onLeaveDays = 0;
  const approvedLeaves = leaves.filter((leave) => employeeIds.has(leave.employeeId) && String(leave.status).toLowerCase() === "approved");

  for (const leave of approvedLeaves) {
    const leaveWorkingDates = getWorkingDates(leave.startDate, leave.endDate, publicHolidays);
    for (const d of leaveWorkingDates) {
      if (workingDatesSet.has(d)) {
        onLeaveDays += 1;
      }
    }
  }

  const totalExpectedRecords = employees.length * workingDates.length;
  const denominator = Math.max(0, totalExpectedRecords - onLeaveDays);

  if (denominator === 0) return 100;

  // 2. Tally attendance matching employees and working days
  const filteredAttendance = attendance.filter((record) => employeeIds.has(record.employeeId) && workingDatesSet.has(record.date));

  let present = 0;
  let late = 0;
  let missingCheckout = 0;
  let halfDay = 0;

  for (const record of filteredAttendance) {
    const status = String(record.status).toLowerCase();
    if (status === "present") present += 1;
    else if (status === "late") late += 1;
    else if (status === "missing_checkout") missingCheckout += 1;
    else if (status === "half_day") halfDay += 1;
  }

  // Formula: (present + late + missing_checkout + 0.5 × half_day) ÷ (working-day records − on_leave)
  const numerator = present + late + missingCheckout + (0.5 * halfDay);
  const rate = Math.min(100, Math.max(0, (numerator / denominator) * 100));
  return Math.round(rate * 10) / 10;
}

export function calculateAbsenteeismByDepartment(employees, attendance, leaves, workingDates, publicHolidays = []) {
  if (!workingDates.length) return [];

  const workingDatesSet = new Set(workingDates);
  const depts = [...new Set(employees.map((e) => e.department || "General"))].sort();

  return depts.map((dept) => {
    const deptEmployees = employees.filter((e) => (e.department || "General") === dept);
    const expectedDays = deptEmployees.length * workingDates.length;
    let absentDays = 0;

    for (const employee of deptEmployees) {
      const empAttendance = new Set(
        attendance.filter((r) => r.employeeId === employee.id && workingDatesSet.has(r.date)).map((r) => r.date)
      );

      const empApprovedLeaves = leaves.filter((l) => l.employeeId === employee.id && String(l.status).toLowerCase() === "approved");
      const leaveDates = new Set();
      for (const l of empApprovedLeaves) {
        for (const d of getWorkingDates(l.startDate, l.endDate, publicHolidays)) {
          if (workingDatesSet.has(d)) leaveDates.add(d);
        }
      }

      for (const date of workingDates) {
        if (!empAttendance.has(date) && !leaveDates.has(date)) {
          absentDays += 1;
        }
      }
    }

    const rate = expectedDays > 0 ? Math.round(((absentDays / expectedDays) * 100) * 10) / 10 : 0;

    return {
      department: dept,
      headcount: deptEmployees.length,
      absentDays,
      expectedDays,
      absenteeismRate: rate,
    };
  });
}

export function calculateLeaveUtilization(employees, leaves, currentYear, publicHolidays = []) {
  const activeCount = employees.length || 1;
  const types = Object.keys(LEAVE_QUOTAS);

  const approvedLeaves = leaves.filter((leave) => String(leave.status).toLowerCase() === "approved");

  return types.map((type) => {
    const quotaPerPerson = LEAVE_QUOTAS[type];
    const isUnlimited = !Number.isFinite(quotaPerPerson);
    const totalQuota = isUnlimited ? "Unlimited" : quotaPerPerson * activeCount;

    let approvedDays = 0;
    for (const leave of approvedLeaves) {
      if (normalizeLeaveType(leave.leaveType) === type) {
        const workingDates = getWorkingDates(leave.startDate, leave.endDate, publicHolidays);
        const thisYearDays = workingDates.filter((date) => date.startsWith(`${currentYear}-`)).length;
        approvedDays += thisYearDays;
      }
    }

    const utilizationRate = !isUnlimited && totalQuota > 0
      ? Math.round(((approvedDays / totalQuota) * 100) * 10) / 10
      : 0;

    return {
      type,
      approvedDays,
      totalQuota,
      utilizationRate,
    };
  });
}

export function getTopLateComers(employees, attendance, workingDates) {
  const workingDatesSet = new Set(workingDates);
  const employeeMap = new Map(employees.map((e) => [e.id, e]));
  const counts = new Map();

  for (const record of attendance) {
    if (record.status === "late" && workingDatesSet.has(record.date)) {
      counts.set(record.employeeId, (counts.get(record.employeeId) || 0) + 1);
    }
  }

  const sorted = [...counts.entries()]
    .map(([employeeId, lateCount]) => {
      const emp = employeeMap.get(employeeId);
      return {
        employeeId,
        name: emp?.name || "Unknown",
        department: emp?.department || "General",
        designation: emp?.designation || "Employee",
        email: emp?.email || "",
        lateCount,
      };
    })
    .sort((a, b) => b.lateCount - a.lateCount);

  return sorted.slice(0, 5);
}

export function calculateHeadcountAndAttrition(employees, currentYear) {
  const activeEmployees = employees.filter((e) => e.isActive !== false);
  const exitedEmployees = employees.filter((e) => e.isActive === false && (e.updatedAt || "").startsWith(`${currentYear}-`));

  const headcount = activeEmployees.length;
  const exits = exitedEmployees.length;
  const avgHeadcount = headcount + (exits / 2);
  const attritionYTD = avgHeadcount > 0 ? Math.round(((exits / avgHeadcount) * 100) * 10) / 10 : 0;

  return {
    headcount,
    exitsYTD: exits,
    attritionYTD,
  };
}

export function calculatePayrollMetrics(employees, payrolls, currentMonthStr) {
  const activeEmployees = employees.filter((e) => e.isActive !== false);

  // If a finalized or draft payroll exists for this month, read totals from it
  const currentPayroll = payrolls.find((p) => p.month === currentMonthStr && p.status !== "cancelled");
  if (currentPayroll && currentPayroll.totals) {
    const totalGross = currentPayroll.totals.gross || 0;
    const totalNet = currentPayroll.totals.netPay || 0;
    const avgSalary = activeEmployees.length > 0 ? Math.round(totalGross / activeEmployees.length) : 0;
    return { totalGross, totalNet, avgSalary };
  }

  // Otherwise calculate from employee basic salaries (Gross = 1.5 * Basic)
  const totalGross = activeEmployees.reduce((sum, emp) => sum + ((Number(emp.salary) || 0) * 1.5), 0);
  const avgSalary = activeEmployees.length > 0 ? Math.round(totalGross / activeEmployees.length) : 0;
  return { totalGross, totalNet: totalGross, avgSalary };
}

export function calculateTenureAndGender(employees, now = new Date()) {
  const tenure = {
    under6Months: 0,
    sixTo12Months: 0,
    oneToTwoYears: 0,
    aboveTwoYears: 0,
  };

  const gender = {
    male: 0,
    female: 0,
    other: 0,
  };

  for (const emp of employees) {
    if (emp.isActive === false) continue;

    // Gender
    const g = String(emp.gender || "").toLowerCase();
    if (g === "female" || g === "f") gender.female += 1;
    else if (g === "male" || g === "m") gender.male += 1;
    else gender.other += 1;

    // Tenure
    const joinDate = parseDate((emp.createdAt || "").slice(0, 10)) || now;
    const diffMonths = (now.getUTCFullYear() - joinDate.getUTCFullYear()) * 12 + (now.getUTCMonth() - joinDate.getUTCMonth());

    if (diffMonths < 6) tenure.under6Months += 1;
    else if (diffMonths < 12) tenure.sixTo12Months += 1;
    else if (diffMonths < 24) tenure.oneToTwoYears += 1;
    else tenure.aboveTwoYears += 1;
  }

  return { tenure, gender };
}

export function buildDashboardAnalytics({ store, user, dateRange, department, startDate, endDate, now = new Date() }) {
  const todayStr = dateKey(now);
  const currentYear = todayStr.slice(0, 4);
  const currentMonthStr = todayStr.slice(0, 7);

  const resolvedRange = resolveDateRange(dateRange, startDate, endDate, now);
  const publicHolidays = store.publicHolidays || [];
  const workingDates = getWorkingDates(resolvedRange.startDate, resolvedRange.endDate, publicHolidays);

  let allEmployees = store.employees || [];
  if (department && department.toLowerCase() !== "all") {
    allEmployees = allEmployees.filter((e) => (e.department || "").toLowerCase() === department.toLowerCase());
  }

  const attendance = store.attendance || [];
  const leaves = store.leaves || [];
  const payrolls = store.payrolls || [];
  const auditLogs = store.auditLogs || [];

  // 1. Overall Calculations
  const attendanceRate = calculateAttendanceRate(allEmployees, attendance, leaves, workingDates, publicHolidays);
  const absenteeismByDept = calculateAbsenteeismByDepartment(allEmployees, attendance, leaves, workingDates, publicHolidays);
  const leaveUtilization = calculateLeaveUtilization(allEmployees, leaves, currentYear, publicHolidays);
  const topLateComers = getTopLateComers(allEmployees, attendance, workingDates);
  const { headcount, attritionYTD } = calculateHeadcountAndAttrition(allEmployees, currentYear);
  const { totalGross: payrollCost, avgSalary } = calculatePayrollMetrics(allEmployees, payrolls, currentMonthStr);

  // Today specific metrics
  const todayAttendance = attendance.filter((r) => r.date === todayStr);
  const presentToday = todayAttendance.filter((r) => ["present", "late", "half_day"].includes(r.status)).length;
  const lateToday = todayAttendance.filter((r) => r.status === "late").length;
  const onLeaveToday = leaves.filter((l) => l.status === "approved" && l.startDate <= todayStr && l.endDate >= todayStr).length;
  const pendingApprovals = leaves.filter((l) => l.status === "pending").length;

  // Headcount by department breakdown
  const deptCountMap = new Map();
  for (const emp of allEmployees) {
    if (emp.isActive !== false) {
      const dept = emp.department || "General";
      deptCountMap.set(dept, (deptCountMap.get(dept) || 0) + 1);
    }
  }
  const headcountByDept = [...deptCountMap.entries()].map(([dept, count]) => ({
    department: dept,
    count,
    percentage: headcount > 0 ? Math.round((count / headcount) * 100) : 0,
  }));

  // Payroll cost by department breakdown
  const payrollCostByDept = [...deptCountMap.keys()].map((dept) => {
    const deptEmps = allEmployees.filter((e) => (e.department || "General") === dept && e.isActive !== false);
    const deptGross = deptEmps.reduce((sum, emp) => sum + ((Number(emp.salary) || 0) * 1.5), 0);
    return {
      department: dept,
      headcount: deptEmps.length,
      totalGross: deptGross,
      avgSalary: deptEmps.length > 0 ? Math.round(deptGross / deptEmps.length) : 0,
    };
  });

  const { tenure, gender } = calculateTenureAndGender(allEmployees, now);

  // Attendance Trend (last 7 working days or dates in range)
  const trendDates = workingDates.slice(-7);
  const attendanceTrend = trendDates.map((date) => {
    const dayRecords = attendance.filter((r) => r.date === date);
    const presentCount = dayRecords.filter((r) => r.status === "present").length;
    const lateCount = dayRecords.filter((r) => r.status === "late").length;
    const halfDayCount = dayRecords.filter((r) => r.status === "half_day").length;
    const attendedCount = presentCount + lateCount + halfDayCount;
    return {
      date,
      present: presentCount,
      late: lateCount,
      halfDay: halfDayCount,
      totalAttended: attendedCount,
      rate: allEmployees.length > 0 ? Math.round((attendedCount / allEmployees.length) * 100) : 0,
    };
  });

  // Self-Service Employee Data Scope
  let employeeDashboard = null;
  if (user.employeeId) {
    const myEmpId = user.employeeId;
    const myAttendance = attendance.filter((r) => r.employeeId === myEmpId);
    const myTodayRecord = myAttendance.find((r) => r.date === todayStr);

    // Hours this week
    const dayOfWeek = now.getUTCDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday));
    const mondayStr = dateKey(monday);
    const sundayStr = dateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), monday.getUTCDate() + 6)));

    const thisWeekRecords = myAttendance.filter((r) => r.date >= mondayStr && r.date <= sundayStr);
    const hoursThisWeek = thisWeekRecords.reduce((total, r) => total + (Number(r.totalWorkHours) || 0), 0);

    // Late count this month
    const lateCountThisMonth = myAttendance.filter((r) => r.date.startsWith(`${currentMonthStr}-`) && r.status === "late").length;

    // Leave balances
    const myApprovedLeaves = leaves.filter((l) => l.employeeId === myEmpId && String(l.status).toLowerCase() === "approved");
    const leaveBalance = {};

    for (const type of Object.keys(LEAVE_QUOTAS)) {
      const quota = LEAVE_QUOTAS[type];
      const isUnlimited = !Number.isFinite(quota);
      let used = 0;
      for (const l of myApprovedLeaves) {
        if (normalizeLeaveType(l.leaveType) === type) {
          const lDates = getWorkingDates(l.startDate, l.endDate, publicHolidays);
          used += lDates.filter((d) => d.startsWith(`${currentYear}-`)).length;
        }
      }
      leaveBalance[type] = {
        used,
        total: isUnlimited ? "Unlimited" : quota,
        remaining: isUnlimited ? "Unlimited" : Math.max(0, quota - used),
      };
    }

    // Last payslip
    let lastPayslip = null;
    const myPayrolls = [...payrolls].reverse();
    for (const p of myPayrolls) {
      const line = (p.lines || []).find((l) => l.employeeId === myEmpId);
      if (line) {
        lastPayslip = {
          month: p.month,
          status: p.status,
          gross: line.gross,
          deductions: line.deductions,
          tax: line.tax,
          netPay: line.netPay,
        };
        break;
      }
    }

    employeeDashboard = {
      kpis: {
        todayStatus: myTodayRecord ? myTodayRecord.status : "not_checked_in",
        checkInAt: myTodayRecord?.checkInAt || null,
        checkOutAt: myTodayRecord?.checkOutAt || null,
        hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
        targetHours: 40,
        lateCountThisMonth,
      },
      leaveBalance,
      lastPayslip,
      recentAttendance: myAttendance.slice(-7).reverse(),
    };
  }

  return {
    filters: {
      dateRange: resolvedRange.key,
      startDate: resolvedRange.startDate,
      endDate: resolvedRange.endDate,
      department: department || "All",
    },
    userRole: user.role,
    admin: ["ADMIN"].includes(user.role)
      ? {
          kpis: {
            headcount,
            attritionYTD,
            payrollCost,
            avgSalary,
            attendanceRate,
          },
          headcountByDept,
          payrollCostByDept,
          genderAndTenure: { tenure, gender },
          auditFeed: auditLogs.slice(-10).reverse(),
        }
      : null,
    hr: ["ADMIN", "HR"].includes(user.role)
      ? {
          kpis: {
            headcount,
            presentToday,
            onLeaveToday,
            lateToday,
            pendingApprovals,
            attendanceRate,
          },
          attendanceTrend,
          absenteeismByDept,
          leaveUtilization,
          topLateComers,
        }
      : null,
    employee: employeeDashboard,
  };
}
