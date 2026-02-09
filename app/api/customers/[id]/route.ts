import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_URL = 'https://teable-production-bedd.up.railway.app';
const TABLE_ID = 'tblmUkwbvrUmxI3q1gd';
const API_KEY = process.env.TEABLE_API_KEY;

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

// --- PATCH ---
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });
    }

    const { id } = params;
    const body = await request.json();
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
        records: [{ id: id, fields: body.fields }]
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
