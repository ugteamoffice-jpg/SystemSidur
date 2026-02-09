import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_URL = 'https://teable-production-bedd.up.railway.app';
const TABLE_ID = 'tbl39DxszH3whkjzovd'; 
const API_KEY = process.env.TEABLE_API_KEY;

// פונקציה שטוענת הכל בצד השרת בלולאה אחת
async function fetchAllRecords() {
  let allRecords: any[] = [];
  let skip = 0;
  const take = 1000;
  let hasMore = true;

  while (hasMore) {
    const endpoint = `${API_URL}/api/v1/table/${TABLE_ID}/record?take=${take}&skip=${skip}&fieldKeyType=id`;
    
    console.log(`📡 Fetching drivers: skip=${skip}, take=${take}`);

    const response = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Teable API error: ${response.status}`);
    }

    const data = await response.json();
    const records = data.records || [];
    
    console.log(`✅ Got ${records.length} records`);

    if (records.length === 0) {
      hasMore = false;
    } else {
      allRecords = [...allRecords, ...records];
      skip += records.length;
      
      if (records.length < take) {
        hasMore = false;
      }
    }
  }

  console.log(`🎉 Total loaded: ${allRecords.length} drivers`);
  return allRecords;
}

export async function GET(request: Request) {
  try {
    const allRecords = await fetchAllRecords();
    
    return NextResponse.json({ 
      records: allRecords,
      nextCursor: null
    });

  } catch (error) {
    console.error("❌ Server Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const endpoint = `${API_URL}/api/v1/table/${TABLE_ID}/record?fieldKeyType=id`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldKeyType: "id", typecast: true, records: [{ fields: body.fields }] }),
      cache: 'no-store'
    });
    if (!response.ok) return NextResponse.json({ error: "Error" }, { status: response.status });
    return NextResponse.json(await response.json());
  } catch (error) { return NextResponse.json({ error: 'Error' }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { recordId, fields } = body;
    const endpoint = `${API_URL}/api/v1/table/${TABLE_ID}/record?fieldKeyType=id`;
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldKeyType: "id", typecast: true, records: [{ id: recordId, fields: fields }] }),
      cache: 'no-store'
    });
    if (!response.ok) return NextResponse.json({ error: "Error" }, { status: response.status });
    return NextResponse.json(await response.json());
  } catch (error) { return NextResponse.json({ error: 'Error' }, { status: 500 }); }
}
