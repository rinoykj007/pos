import { auth } from "@/auth";
import { checkDuplicate, insertData } from "@/lib/crud-actions/general-actions";
import { uploadImage } from "@/lib/server/helpers/imageUpload";
import { FullEmployeeFormSchema } from "@/lib/zod-schema/restaurant.zod";
import { NextRequest, NextResponse } from "next/server";



const path = '/api/employees';



/* ================================================== 
=== [POST] Create a New Employee with All Details ===
================================================== */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user.id

    // === Authenticate User ===
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    // === Parse multipart form data ===
    const formData = await req.formData();
    const jsonData = formData.get("data");
    const image = formData.get("image") as File | null;

    if (typeof jsonData !== "string") {
      return NextResponse.json({ error: "Invalid form submission. Please try again." }, { status: 400 });
    }

    // === Parse and Validate Zod Data ===
    let parsed;
    try {
      parsed = FullEmployeeFormSchema.parse(JSON.parse(jsonData));
    } catch (err) {
      console.error(`[POST ${path}] Validation failed:`);
      return NextResponse.json({ error: "Form validation failed. Please check all fields.", details: err }, { status: 400 });
    }

    const { personalInfo, employmentRecord, salaryChanges } = parsed;

    // === Check for Duplicate CNIC ===
    const duplicate = await checkDuplicate("employeesTable", "CNIC", personalInfo.CNIC);
    if (duplicate) {
      return NextResponse.json(
        { error: "An employee with this CNIC already exists." },
        { status: 409 }
      );
    }

    // === Upload Profile Image (If Any) ===
    let imagePath: string | null = null;
    if (image instanceof File) {
      try {
        imagePath = await uploadImage(image, "employees_profile_image"); // <- use helper
      } catch (err) {
        console.error(`[PUT ${path}] Image upload failed:`, err);
        return NextResponse.json({ error: "We couldn't upload the image. Please try again." }, { status: 500 });
      }
    }

    // 1. Insert into Employees collection
    const { insertId: employeeId } = await insertData("employeesTable", {
      image: imagePath,
      name: personalInfo.name.trim(),
      CNIC: personalInfo.CNIC.trim(),
      fatherName: personalInfo.fatherName.trim(),
      email: personalInfo.email.trim(),
      phone: personalInfo.phone.trim(),
      salary: salaryChanges.newSalary.trim(),
    });

    // 2. Insert into Employment Records collection
    await insertData("employmentRecordsTable", {
      employeeId,
      designation: employmentRecord.designation.trim(),
      shift: employmentRecord.shift.trim(),
      status: employmentRecord.status,
      joinedAt: new Date(employmentRecord.joinedAt),
      changeType: employmentRecord.changeType,
      resignedAt: employmentRecord.resignedAt ? new Date(employmentRecord.resignedAt) : null,
    });

    // 3. Insert into Salary Changes collection
    await insertData("salaryChangesTable", {
      employeeId,
      previousSalary: salaryChanges.previousSalary?.trim() ?? null,
      newSalary: salaryChanges.newSalary.trim(),
      reason: salaryChanges.reason?.trim() ?? null,
      changeType: salaryChanges.changeType,
    });

    // === Success Response ===
    return NextResponse.json(
      { message: "Employee created successfully.", insertedId: employeeId },
      { status: 201 }
    );
  } catch (error) {
    console.error(`[POST ${path}] Failed to create employee:`, error);

    return NextResponse.json(
      { error: "Something went wrong while creating the employee. Please try again shortly." },
      { status: 500 }
    );
  }
}
