"use server";

import { EmployeeCompleteDetailsInterface, EmployeeWithLatestRecord } from "@/lib/definations";
import { getMongoDb } from "@/lib/mongodb";
import { mongoCollections } from "@/lib/mongodb/collections";
import { deleteData } from "./general-actions";

export const getAllEmployeesWithLatestRecord = async (): Promise<EmployeeWithLatestRecord[]> => {
  const mongoDb = await getMongoDb();
  const [employees, records] = await Promise.all([
    mongoDb.collection(mongoCollections.employeesTable).find().sort({ id: 1 }).toArray(),
    mongoDb.collection(mongoCollections.employmentRecordsTable).find().sort({ id: -1 }).toArray(),
  ]);

  return employees.map((employee) => {
    const latestRecord = records.find((record) => Number(record.employeeId) === Number(employee.id));
    return {
      id: employee.id,
      image: employee.image ?? null,
      name: employee.name,
      CNIC: employee.CNIC,
      fatherName: employee.fatherName,
      email: employee.email,
      phone: employee.phone,
      designation: latestRecord?.designation ?? null,
      shift: latestRecord?.shift ?? null,
      status: latestRecord?.status ?? null,
      joinedAt: latestRecord?.joinedAt ? new Date(latestRecord.joinedAt).toISOString() : null,
    };
  });
};

export const fetchEmployee = async (employeeId: number): Promise<EmployeeCompleteDetailsInterface | null> => {
  const mongoDb = await getMongoDb();
  const [employee, employmentRecords, salaryChanges] = await Promise.all([
    mongoDb.collection(mongoCollections.employeesTable).findOne({ id: employeeId }),
    mongoDb.collection(mongoCollections.employmentRecordsTable).find({ employeeId }).sort({ id: -1 }).toArray(),
    mongoDb.collection(mongoCollections.salaryChangesTable).find({ employeeId }).sort({ id: -1 }).toArray(),
  ]);

  if (!employee) return null;

  return {
    id: employee.id ?? null,
    image: employee.image ?? null,
    name: employee.name,
    CNIC: employee.CNIC,
    fatherName: employee.fatherName,
    email: employee.email,
    phone: employee.phone,
    salary: String(employee.salary ?? "0.00"),
    createdAt: new Date(employee.createdAt ?? new Date()).toISOString(),
    employmentRecord: employmentRecords.map((record) => ({
      id: record.id,
      designation: record.designation,
      shift: record.shift,
      status: record.status,
      joinedAt: new Date(record.joinedAt).toISOString(),
      resignedAt: record.resignedAt ? new Date(record.resignedAt).toISOString() : null,
      changeType: record.changeType,
      createdAt: record.createdAt ?? new Date(),
    })),
    salaryChanges: salaryChanges.map((change) => ({
      id: change.id,
      previousSalary: change.previousSalary ? parseFloat(change.previousSalary) : null,
      newSalary: parseFloat(change.newSalary),
      reason: change.reason ?? null,
      changeType: change.changeType,
      createdAt: change.createdAt ?? new Date(),
    })),
  };
};

export const deleteEmployeeWithRecord = async (employeeId: number) => {
  const mongoDb = await getMongoDb();
  await Promise.all([
    deleteData("employmentRecordsTable", "employeeId", employeeId),
    deleteData("salaryChangesTable", "employeeId", employeeId),
    mongoDb.collection(mongoCollections.payrollsTable).deleteMany({ employeeId, status: "pending" }),
    deleteData("employeesTable", "id", employeeId),
  ]);
};
