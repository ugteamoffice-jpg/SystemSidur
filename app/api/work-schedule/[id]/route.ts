import { NextResponse } from "next/server";
import { teableClient } from "@/lib/teable-client";

// ה-ID הנכון שהוצאתי מהקישור ששלחת
const TABLE_ID = "tblUgEhLuyCwEK2yWG4";

// 1. פונקציית GET (כדי שהדפדפן יראה שהנתיב קיים)
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({ 
    message: "Work schedule API is active", 
    tableId: TABLE_ID,
    recordId: params.id 
  });
}

// 2. פונקציית PATCH (לעריכה ושמירה)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    console.log(`Updating record ${id} in table ${TABLE_ID}`);

    // שליחת העדכון ל-Teable
    const result = await teableClient.updateRecord(TABLE_ID, id, body.fields);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Update Error:", error);
    // החזרת שגיאה מפורטת לדפדפן כדי שנדע אם משהו משתבש
    return NextResponse.json(
      { 
        error: "Update Failed", 
        details: error.message || "Unknown error" 
      },
      { status: 500 }
    );
  }
}

// 3. פונקציית DELETE (למחיקה)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await teableClient.deleteRecord(TABLE_ID, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete Error:", error);
    return NextResponse.json(
      { error: "Delete Failed" }, 
      { status: 500 }
    );
  }
}
