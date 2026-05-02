import { auth } from "@/auth";
import { insertData, updateData } from "@/lib/crud-actions/general-actions";
import { SalaryChangeFormSchema } from "@/lib/zod-schema/restaurant.zod";
import { NextRequest, NextResponse } from "next/server";



const path = '/api/employees/[slug]/salary-changes';



/* ================================================================== 
=== [POST] Add a New Salary Change Record for a Specific Employee ===
================================================================== */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await auth();
    const userId = session?.user.id

    // === Authenticate User ===
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    // === Extract Employee ID from Params ===
    const { slug } = await params;
    const EmployeeId = Number(slug);

    // === Parse & Validate Request Body ===
    const body = await req.json();
    const parsed = SalaryChangeFormSchema.parse(body);
    const { previousSalary, newSalary, reason, changeType, } = parsed;

    const insert = await insertData("salaryChangesTable", {
      employeeId: EmployeeId,
      previousSalary: previousSalary?.trim() ?? null,
      newSalary: newSalary.trim(),
      reason: reason?.trim() ?? null,
      changeType: changeType,
    });

    await updateData("employeesTable", 'id', EmployeeId, {
      salary: newSalary
    });

    const result = {
      insertedId: insert.insertId,
    };

    // === Success Response ===
    return NextResponse.json(
      { message: "Salary updated successfully.", insertedId: result?.insertedId },
      { status: 201 }
    );
  } catch (error) {
    console.error(`[POST ${path}] Failed to update salary:`, error);

    return NextResponse.json(
      { error: "Something went wrong while updating the employee's salary. Please try again in a few moments." },
      { status: 500 }
    );
  }
}
