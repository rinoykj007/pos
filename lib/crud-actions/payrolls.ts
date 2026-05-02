"use server";

import { EmployeePayrollInterface, PayrollDialogSalaryRow, PayrollSummary } from "@/lib/definations";
import { getMongoDb } from "@/lib/mongodb";
import { mongoCollections } from "@/lib/mongodb/collections";
import { formatMonth } from "@/lib/utils";
import { insertData, updateData } from "./general-actions";

export const getAllPayrollsWithEmployeeDetails = async () => {
  const mongoDb = await getMongoDb();
  const [employees, records, payrolls] = await Promise.all([
    mongoDb.collection(mongoCollections.employeesTable).find().sort({ id: 1 }).toArray(),
    mongoDb.collection(mongoCollections.employmentRecordsTable).find().sort({ id: -1 }).toArray(),
    mongoDb.collection(mongoCollections.payrollsTable).find().toArray(),
  ]);

  return employees.map((employee, index) => {
    const latestRecord = records.find((record) => Number(record.employeeId) === Number(employee.id));
    const employeePayrolls = payrolls.filter((payroll) => Number(payroll.employeeId) === Number(employee.id));
    const unpaidPayrolls = employeePayrolls.filter((payroll) => payroll.status === "pending");
    const latestPayroll = employeePayrolls.sort((a, b) => String(b.month).localeCompare(String(a.month)))[0];

    return {
      id: index + 1,
      employeeId: employee.id,
      employee: employee.name,
      designation: latestRecord?.designation ?? null,
      unpaidMonths: unpaidPayrolls.map((payroll) => payroll.month),
      currentSalary: employee.salary ?? "0.00",
      prevBalance: unpaidPayrolls.reduce((sum, payroll) => sum + Number(payroll.totalPay ?? 0), 0),
      thisMonth: Number(employee.salary ?? 0) + Number(latestPayroll?.bonus ?? 0) - Number(latestPayroll?.penalty ?? 0),
      status: latestPayroll?.status ?? "pending",
    };
  });
};

function generateMonthsBetween(start: string, end: string): string[] {
  const months: string[] = [];
  const current = new Date(start + "-01");
  const last = new Date(end + "-01");
  while (current <= last) {
    months.push(formatMonth(current));
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}

export async function refreshPayrolls(): Promise<{ success: boolean }> {
  const mongoDb = await getMongoDb();
  const [employees, records, payrolls] = await Promise.all([
    mongoDb.collection(mongoCollections.employeesTable).find().toArray(),
    mongoDb.collection(mongoCollections.employmentRecordsTable).find().sort({ id: -1 }).toArray(),
    mongoDb.collection(mongoCollections.payrollsTable).find().toArray(),
  ]);

  for (const employee of employees) {
    const latestRecord = records.find((record) => Number(record.employeeId) === Number(employee.id));
    if (!latestRecord) continue;

    const startMonth = formatMonth(new Date(latestRecord.joinedAt));
    const endDate = latestRecord.resignedAt ? new Date(latestRecord.resignedAt) : new Date();
    if (!latestRecord.resignedAt) endDate.setMonth(endDate.getMonth() - 1);

    const existingMonths = new Set(
      payrolls
        .filter((payroll) => Number(payroll.employeeId) === Number(employee.id))
        .map((payroll) => String(payroll.month))
    );

    for (const month of generateMonthsBetween(startMonth, formatMonth(endDate))) {
      if (existingMonths.has(month) || Number(employee.salary ?? 0) <= 0) continue;
      await insertData("payrollsTable", {
        employeeId: employee.id,
        image: employee.image ?? null,
        name: employee.name,
        CNIC: employee.CNIC,
        email: employee.email,
        month,
        basicPay: String(employee.salary),
        totalPay: String(employee.salary),
        bonus: "0.00",
        penalty: "0.00",
        status: "pending",
        createdAt: new Date(),
      });
    }
  }

  return { success: true };
}

export async function fetchEmployeeUnpaidPayrolls(
  employeeId: number,
  status: "pending" | "paid" | "all" = "all",
  from?: string,
  to?: string
): Promise<PayrollDialogSalaryRow[]> {
  const mongoDb = await getMongoDb();
  const filter: Record<string, unknown> = { employeeId };
  if (status !== "all") filter.status = status;
  if (from || to) {
    filter.month = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }

  const payrolls = await mongoDb.collection(mongoCollections.payrollsTable).find(filter).sort({ id: -1 }).toArray();
  return payrolls.map((payroll) => ({
    id: payroll.id,
    description: payroll.description ?? "",
    basicPay: payroll.basicPay,
    bonus: payroll.bonus ?? "0.00",
    penalty: payroll.penalty ?? "0.00",
    totalPay: payroll.totalPay,
    month: payroll.month,
    paidAt: payroll.paidAt ? new Date(payroll.paidAt).toISOString() : null,
    status: payroll.status,
  }));
}

export async function getEmployeePayrollSummary(employeeId: number): Promise<PayrollSummary> {
  const mongoDb = await getMongoDb();
  const payrolls = await mongoDb.collection(mongoCollections.payrollsTable).find({ employeeId }).toArray();

  let totalAmountPaid = 0;
  let totalAmountPending = 0;
  let totalPaidMonths = 0;
  let totalUnpaidMonths = 0;

  for (const payroll of payrolls) {
    const amount = parseFloat(String(payroll.totalPay ?? 0));
    if (payroll.status === "paid") {
      totalAmountPaid += amount;
      totalPaidMonths++;
    } else {
      totalAmountPending += amount;
      totalUnpaidMonths++;
    }
  }

  return {
    totalAmountPaid: totalAmountPaid.toFixed(2),
    totalAmountPending: totalAmountPending.toFixed(2),
    totalPaidMonths: String(totalPaidMonths),
    totalUnpaidMonths: String(totalUnpaidMonths),
  };
}

export async function markUnpaidPayrollsAsPaid(salaries: PayrollDialogSalaryRow[], employeeId: number): Promise<boolean> {
  if (!salaries?.length) return false;

  for (const salary of salaries) {
    await updateData("payrollsTable", "id", Number(salary.id), {
      basicPay: salary.basicPay,
      bonus: salary.bonus,
      penalty: salary.penalty,
      totalPay: salary.totalPay,
      description: salary.description,
      paidAt: new Date(),
      status: "paid",
    });

    await insertData("transactionsTable", {
      categoryId: 1,
      title: "Salary Payment to Employee",
      amount: salary.totalPay,
      type: "debit",
      sourceType: "payroll",
      sourceId: Number(salary.id),
      createdAt: new Date(),
    });
  }

  return true;
}

export async function fetchPayrollWithDetail(payrollId: number): Promise<EmployeePayrollInterface> {
  const mongoDb = await getMongoDb();
  const payroll = await mongoDb.collection(mongoCollections.payrollsTable).findOne({ id: payrollId });
  if (!payroll) throw new Error("Payroll not found");

  const employee = payroll.employeeId
    ? await mongoDb.collection(mongoCollections.employeesTable).findOne({ id: payroll.employeeId })
    : null;

  return {
    id: payroll.id,
    employeeId: payroll.employeeId,
    employeeImage: employee?.image ?? payroll.image ?? null,
    employeeName: employee?.name ?? payroll.name ?? "",
    employeeCNIC: employee?.CNIC ?? payroll.CNIC ?? "",
    employeeEmail: employee?.email ?? payroll.email ?? "",
    basicPay: payroll.basicPay,
    bonus: payroll.bonus ?? "0.00",
    penalty: payroll.penalty ?? "0.00",
    totalPay: payroll.totalPay,
    description: payroll.description ?? "",
    month: payroll.month,
    status: payroll.status,
    paidAt: payroll.paidAt ? new Date(payroll.paidAt).toISOString() : "",
  };
}
