import { NextResponse } from "next/server";
import { teableClient } from "@/lib/teable-client";

const TABLE_ID = "tblUgEhLuyCwEK2yWG4";

// פונקציית GET
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // תיקון טיפוס ל-Next.js 15/16
) {
  const { id } = await params; // חובה לעשות await!
  return NextResponse.json({ 
    message: "Work schedule API is active", 
    tableId: TABLE_ID,
    recordId: id 
  });
}

// פונקציית PATCH
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // תיקון טיפוס ל-Next.js 15/16
) {
  try {
    const { id } = await params; // חובה לעשות await!
    const body = await request.json();

    console.log(`Updating record ${id} in table ${TABLE_ID}`);

    if (!id || id === 'undefined') {
      return NextResponse.json({ error: "Record ID is missing" }, { status: 400 });
    }

    const result = await teableClient.updateRecord(TABLE_ID, id, body.fields);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Update Error:", error);
    return NextResponse.json(
      { 
        error: "Update Failed", 
        details: error.message || "Unknown error" 
      },
      { status: 500 }
    );
  }
}

// פונקציית DELETE
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // תיקון טיפוס ל-Next.js 15/16
) {
  try {
    const { id } = await params; // חובה לעשות await!
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
