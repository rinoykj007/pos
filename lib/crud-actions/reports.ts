"use server";

import { addMonths, eachMonthOfInterval, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { FinancialChartResponse, ReportsMetricCard, TransactionsReportResult } from "@/lib/definations";
import { getMongoDb } from "@/lib/mongodb";
import { mongoCollections } from "@/lib/mongodb/collections";

function inRange(date: Date, start: Date, end: Date) {
  return date >= start && date <= end;
}

function sumAmounts(rows: { amount: string }[]) {
  return rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
}

export const getHeaderCardMetrics = async (): Promise<ReportsMetricCard[]> => {
  const mongoDb = await getMongoDb();
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const [transactions, employees] = await Promise.all([
    mongoDb.collection<{ amount: string; type: "credit" | "debit"; createdAt?: Date }>(mongoCollections.transactionsTable).find().toArray(),
    mongoDb.collection<{ salary?: string }>(mongoCollections.employeesTable).find().toArray(),
  ]);

  const currentRevenue = sumAmounts(transactions.filter((txn) => txn.type === "credit" && inRange(new Date(txn.createdAt ?? new Date()), thisMonthStart, thisMonthEnd)));
  const lastRevenue = sumAmounts(transactions.filter((txn) => txn.type === "credit" && inRange(new Date(txn.createdAt ?? new Date()), lastMonthStart, lastMonthEnd)));
  const currentExpense = sumAmounts(transactions.filter((txn) => txn.type === "debit" && inRange(new Date(txn.createdAt ?? new Date()), thisMonthStart, thisMonthEnd)));
  const lastExpense = sumAmounts(transactions.filter((txn) => txn.type === "debit" && inRange(new Date(txn.createdAt ?? new Date()), lastMonthStart, lastMonthEnd)));

  const revenueChangePercent = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 : 0;
  const expenseChangePercent = lastExpense > 0 ? ((currentExpense - lastExpense) / lastExpense) * 100 : 0;

  return [
    {
      title: "Total Revenue",
      value: currentRevenue.toFixed(2),
      currency: true,
      change: `${revenueChangePercent >= 0 ? "+" : ""}${revenueChangePercent.toFixed(1)}%`,
      trend: revenueChangePercent >= 0 ? "Trending up this month" : "Down from last month",
      description: "Revenue for the current month",
    },
    {
      title: "Total Expense",
      value: currentExpense.toFixed(2),
      currency: true,
      change: `${expenseChangePercent >= 0 ? "+" : ""}${expenseChangePercent.toFixed(1)}%`,
      trend: expenseChangePercent >= 0 ? "Expenses increased this month" : "Spending reduced compared to last month",
      description: "Expenses for the current month",
    },
    { title: "Total Employees", value: employees.length.toString(), description: "Total onboarded employees" },
    {
      title: "Active Employees",
      value: employees.filter((employee) => Number(employee.salary ?? 0) > 0).length.toString(),
      description: "Employees actively working",
    },
  ];
};

export const loadFinancialChartData = async (view: "month" | "year", duration: string): Promise<FinancialChartResponse> => {
  const mongoDb = await getMongoDb();
  const transactions = await mongoDb
    .collection<{ amount: string; type: "credit" | "debit"; createdAt?: Date }>(mongoCollections.transactionsTable)
    .find()
    .toArray();

  if (view === "month") {
    const [year, month] = duration.split("-");
    const startDate = new Date(`${year}-${month}-01`);
    const endDate = addMonths(startDate, 1);
    const rows = transactions.filter((txn) => {
      const date = new Date(txn.createdAt ?? new Date());
      return date >= startDate && date < endDate;
    });

    const dailyMap = new Map<string, { income: number; expense: number }>();
    let totalIncome = 0;
    let totalExpense = 0;

    for (const row of rows) {
      const key = format(new Date(row.createdAt ?? new Date()), "yyyy-MM-dd");
      const entry = dailyMap.get(key) ?? { income: 0, expense: 0 };
      const amount = parseFloat(row.amount);
      if (row.type === "credit") {
        entry.income += amount;
        totalIncome += amount;
      } else {
        entry.expense += amount;
        totalExpense += amount;
      }
      dailyMap.set(key, entry);
    }

    const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
    return {
      data: Array.from({ length: daysInMonth }, (_, i) => {
        const date = `${year}-${month}-${String(i + 1).padStart(2, "0")}`;
        const values = dailyMap.get(date) ?? { income: 0, expense: 0 };
        return { date, income: values.income.toFixed(2), expense: values.expense.toFixed(2) };
      }),
      summary: {
        incomes: totalIncome.toFixed(2),
        expense: totalExpense.toFixed(2),
        revenue: (totalIncome - totalExpense).toFixed(2),
      },
    };
  }

  const yearStart = new Date(`${duration}-01-01`);
  const yearEnd = new Date(`${duration}-12-31`);
  const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });
  const monthlyMap = new Map(months.map((month) => [format(month, "yyyy-MM"), { income: 0, expense: 0 }]));
  let totalIncome = 0;
  let totalExpense = 0;

  for (const row of transactions) {
    const date = new Date(row.createdAt ?? new Date());
    if (date < yearStart || date >= addMonths(yearStart, 12)) continue;
    const key = format(date, "yyyy-MM");
    const entry = monthlyMap.get(key);
    if (!entry) continue;
    const amount = parseFloat(row.amount);
    if (row.type === "credit") {
      entry.income += amount;
      totalIncome += amount;
    } else {
      entry.expense += amount;
      totalExpense += amount;
    }
  }

  return {
    data: Array.from(monthlyMap.entries()).map(([month, values]) => ({
      date: `${month}-01`,
      income: values.income.toFixed(2),
      expense: values.expense.toFixed(2),
    })),
    summary: {
      incomes: totalIncome.toFixed(2),
      expense: totalExpense.toFixed(2),
      revenue: (totalIncome - totalExpense).toFixed(2),
    },
  };
};

export const getTransactionsForReports = async (
  searchTerm: string = "",
  pageNumber: number,
  pageSize: number
): Promise<TransactionsReportResult> => {
  const mongoDb = await getMongoDb();
  const search = searchTerm.trim();
  const filter = search
    ? {
        $or: [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          { amount: { $regex: search, $options: "i" } },
          { type: { $regex: search, $options: "i" } },
          { sourceType: { $regex: search, $options: "i" } },
        ],
      }
    : {};

  const [transactions, categories, totalRecords] = await Promise.all([
    mongoDb.collection(mongoCollections.transactionsTable).find(filter).sort({ id: -1 }).skip((pageNumber - 1) * pageSize).limit(pageSize).toArray(),
    mongoDb.collection(mongoCollections.transactionCategoriesTable).find().toArray(),
    mongoDb.collection(mongoCollections.transactionsTable).countDocuments(filter),
  ]);

  const categoriesById = new Map(categories.map((category) => [Number(category.id), category]));

  return {
    query: search || null,
    totalRecords,
    page: pageNumber,
    totalPages: Math.ceil(totalRecords / pageSize),
    pageSize,
    transactions: transactions.map((txn) => {
      const category = categoriesById.get(Number(txn.categoryId));
      return {
        id: txn.id,
        title: txn.title,
        description: txn.description ?? null,
        amount: txn.amount,
        categoryId: txn.categoryId,
        category: category?.category ?? null,
        categoryDescription: category?.description ?? null,
        type: txn.type,
        sourceType: txn.sourceType,
        sourceId: txn.sourceId ?? null,
        createdAt: new Date(txn.createdAt ?? new Date()).toISOString(),
      };
    }),
  };
};
