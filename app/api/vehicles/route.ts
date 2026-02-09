import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const TABLE_ID = 'tblbRTqAuL4OMkNnUu7'; // מזהה טבלת רכבים
    const API_URL = 'https://teable-production-bedd.up.railway.app';
    const API_KEY = process.env.TEABLE_API_KEY;

    const response = await fetch(`${API_URL}/api/table/${TABLE_ID}/record?take=1000`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch vehicles' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
