import { NextResponse } from "next/server";
import { teableClient } from "@/lib/teable-client";

// זה ה-ID של טבלת סידור העבודה שלקחתי מהקוד שלך
const TABLE_ID = "tblVAQgfYOLfvCZdqqj"; 

// 1. פונקציה לעדכון (PATCH) - זה מה שהיה חסר לך!
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    console.log(`Updating work schedule record ${id}...`);

    // שימוש בלקוח המתוקן שלנו לעדכון
    // אנחנו שולחים את body.fields כי הלוג הראה שהנתונים מגיעים עטופים ב-fields
    const result = await teableClient.updateRecord(TABLE_ID, id, body.fields);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Update error:", error);
    return NextResponse.json(
      { error: "Failed to update record" },
      { status: 500 }
    );
  }
}

// 2. פונקציה למחיקה (DELETE) - שמרתי אותה אבל שדרגתי לשימוש בלקוח
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    console.log(`Deleting work schedule record ${id}...`);

    await teableClient.deleteRecord(TABLE_ID, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete record" },
      { status: 500 }
    );
  }
}
