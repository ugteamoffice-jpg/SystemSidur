import { NextResponse } from "next/server";
import { teableClient } from "@/lib/teable-client";

// ודא שזה ה-ID הנכון
const TABLE_ID = "tblUgEhLuyCwEK2yWG4";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json({ 
    message: "Work schedule API is active", 
    tableId: TABLE_ID,
    recordId: id 
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    console.log(`API Route: Updating record ${id}...`);

    if (!id || id === 'undefined') {
      return NextResponse.json({ error: "Record ID is missing" }, { status: 400 });
    }

    // 1. מבצעים את העדכון
    const result = await teableClient.updateRecord(TABLE_ID, id, body.fields);

    // 2. *** התיקון שמכריח את החלון להיסגר ***
    // אנחנו בודקים: האם קיבלנו "קופסה" (רשימה)? אם כן, נוציא את הרשומה החוצה.
    let finalResponse = result;
    
    // בדיקה 1: האם זה המבנה של Teable Bulk Update?
    if (result && result.records && Array.isArray(result.records)) {
        console.log("API Route: Extracting single record from 'records' array");
        finalResponse = result.records[0];
    } 
    // בדיקה 2: האם זה סתם מערך?
    else if (Array.isArray(result)) {
        console.log("API Route: Extracting single record from plain array");
        finalResponse = result[0];
    }

    console.log("API Route: Sending clean response to client.");
    
    // 3. מחזירים לאפליקציה אובייקט נקי
    return NextResponse.json(finalResponse);

  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json(
      { 
        error: "Update Failed", 
        details: error.message || "Unknown error" 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await teableClient.deleteRecord(TABLE_ID, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Delete Failed" }, { status: 500 });
  }
}
