// lib/teable-client.ts

// שים לב: אני מכריח כאן את הכתובת המלאה כולל /api
// כדי למנוע מצב שמשתנה סביבה שגוי דורס אותה
const BASE_URL = 'https://teable-production-bedd.up.railway.app';
const TEABLE_API_URL = `${BASE_URL}/api`;

const API_KEY = process.env.TEABLE_API_KEY;

export const teableClient = {
  
  async getRecords(tableId: string, query?: any) {
     if (!API_KEY) throw new Error('Missing TEABLE_API_KEY');
     
     const url = new URL(`${TEABLE_API_URL}/table/${tableId}/record`);
     if (query) Object.keys(query).forEach(key => url.searchParams.append(key, query[key]));
     
     const res = await fetch(url.toString(), {
       headers: { 'Authorization': `Bearer ${API_KEY}` },
       cache: 'no-store'
     });
     
     if (!res.ok) throw new Error(`Fetch failed: ${await res.text()}`);
     return await res.json();
  },

  async createRecord(tableId: string, fields: any) {
    if (!API_KEY) throw new Error('Missing TEABLE_API_KEY');
    
    const res = await fetch(`${TEABLE_API_URL}/table/${tableId}/record`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: [{ fields }] }),
    });
    
    if (!res.ok) {
        const err = await res.text();
        console.error("Teable Create Error:", err);
        throw new Error(`Teable Create Error: ${err}`);
    }
    return await res.json();
  },

  async updateRecord(tableId: string, recordId: string, fields: any) {
    if (!API_KEY) throw new Error('Missing TEABLE_API_KEY');

    // הדפסה ללוג כדי שתהיה בטוח שהכתובת נכונה הפעם
    const fullUrl = `${TEABLE_API_URL}/table/${tableId}/record/${recordId}`;
    console.log(`Sending PATCH request to: ${fullUrl}`);
    
    const res = await fetch(fullUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        record: { fields }
      }),
    });
    
    if (!res.ok) {
        const errorText = await res.text(); 
        // הדפסת השגיאה המלאה ללוג
        console.error(`Teable Update Failed. URL: ${fullUrl}, Error:`, errorText);
        throw new Error(`Teable Error: ${errorText}`);
    }
    
    return await res.json();
  },

  async deleteRecord(tableId: string, recordId: string) {
    if (!API_KEY) throw new Error('Missing TEABLE_API_KEY');
    
    const res = await fetch(`${TEABLE_API_URL}/table/${tableId}/record/${recordId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    });
    
    if (!res.ok) throw new Error(`Delete failed: ${await res.text()}`);
    return true;
  }
};
