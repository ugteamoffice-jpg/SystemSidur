// lib/teable-client.ts

// *** התיקון הקריטי: הכתובת של השרת שלך ***
// אם יש לך משתנה סביבה TEABLE_API_URL זה ייקח אותו, אחרת זה ייקח את הכתובת של Railway שלך
const TEABLE_API_URL = process.env.TEABLE_API_URL || 'https://teable-production-bedd.up.railway.app/api';
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

    // הדפסה ללוג כדי לוודא שהכתובת נכונה
    console.log(`Sending update to: ${TEABLE_API_URL}/table/${tableId}/record/${recordId}`);
    
    const res = await fetch(`${TEABLE_API_URL}/table/${tableId}/record/${recordId}`, {
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
        console.error(`Teable Update Failed for ${recordId}:`, errorText);
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
