import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_URL = 'https://teable-production-bedd.up.railway.app';
const TABLE_ID = 'tblUgEhLuyCwEK2yWG4';
const API_KEY = process.env.TEABLE_API_KEY;
const DATE_FIELD_ID = 'fldvNsQbfzMWTc7jakp';

// פונקציית עזר לטיפול בתשובות JSON
async function safeJsonParse(response: Response) {
  const text = await response.text();
  if (!text || text.trim() === '') {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('Failed to parse JSON:', text);
    return null;
  }
}

// --- GET ---
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const take = searchParams.get('take') || '1000';
    const dateParam = searchParams.get('date'); 

    let endpoint = `${API_URL}/api/v1/table/${TABLE_ID}/record?take=${take}&fieldKeyType=id`;

    if (dateParam) {
      const filterObj = {
        operator: "and",
        filterSet: [{ fieldId: DATE_FIELD_ID, operator: "is", value: dateParam }]
      };
      endpoint += `&filter=${encodeURIComponent(JSON.stringify(filterObj))}`;
    }

    const response = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
      cache: 'no-store'
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed' }, { status: response.status });
    }

    const data = await safeJsonParse(response);
    return NextResponse.json(data || { records: [] });
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// --- POST ---
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const endpoint = `${API_URL}/api/v1/table/${TABLE_ID}/record?fieldKeyType=id`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fieldKeyType: "id", 
        typecast: true, 
        records: [{ fields: body.fields }]
      }),
      cache: 'no-store'
    });

    if (!response.ok) {
      const errorData = await safeJsonParse(response);
      return NextResponse.json({ 
        error: "Teable Error", 
        details: errorData 
      }, { status: response.status });
    }

    const data = await safeJsonParse(response);
    return NextResponse.json(data || { success: true });
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// --- PATCH ---
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { recordId, fields } = body;
    const endpoint = `${API_URL}/api/v1/table/${TABLE_ID}/record?fieldKeyType=id`;

    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fieldKeyType: "id", 
        typecast: true, 
        records: [{ id: recordId, fields: fields }]
      }),
      cache: 'no-store'
    });

    if (!response.ok) {
      const errorData = await safeJsonParse(response);
      return NextResponse.json({ 
        error: "Update Failed", 
        details: errorData 
      }, { status: response.status });
    }

    const data = await safeJsonParse(response);
    return NextResponse.json(data || { success: true });
  } catch (error) {
    console.error('PATCH Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// --- DELETE - עם תיקון לפורמט מערך ---
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!API_KEY) {
      return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });
    }
    
    if (!id) {
      return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }

    console.log(`🗑️ Attempting to delete record: ${id}`);

    // הפתרון: Teable דורש recordIds[] (עם סוגריים מרובעות!)
    const teableUrl = new URL(`${API_URL}/api/v1/table/${TABLE_ID}/record`);
    teableUrl.searchParams.append('recordIds[]', id);

    console.log(`📡 DELETE URL: ${teableUrl.toString()}`);

    const response = await fetch(teableUrl.toString(), {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Teable Delete Error:", errorText);
      return NextResponse.json({ 
        error: "Delete Failed", 
        details: errorText,
        recordId: id
      }, { status: response.status });
    }

    const data = await safeJsonParse(response);
    console.log("✅ Delete successful for record:", id);
    
    return NextResponse.json(data || { success: true, deletedId: id });

  } catch (error) {
    console.error("❌ DELETE Exception:", error);
    return NextResponse.json({ 
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
