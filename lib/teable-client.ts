// lib/teable-client.ts

const BASE_URL = 'https://teable-production-bedd.up.railway.app';
const TEABLE_API_URL = `${BASE_URL}/api`;
const API_KEY = process.env.TEABLE_API_KEY;

export const teableClient = {
  
  // 1. שליפה
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

  // 2. יצירה
  async createRecord(tableId: string, fields: any) {
    if (!API_KEY) throw new Error('Missing TEABLE_API_KEY');
    
    // גם כאן נוסיף את זה לגוף הבקשה ליתר ביטחון
    const res = await fetch(`${TEABLE_API_URL}/table/${tableId}/record`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fieldKeyType: 'id', // <--- הנה התוספת החשובה
        records: [{ fields }] 
      }),
    });
    
    if (!res.ok) {
        const err = await res.text();
        console.error("Teable Create Error:", err);
        throw new Error(`Teable Create Error: ${err}`);
    }
    return await res.json();
  },

  // 3. עדכון - התיקון הסופי
  async updateRecord(tableId: string, recordId: string, fields: any) {
    if (!API_KEY) throw new Error('Missing TEABLE_API_KEY');

    const url = `${TEABLE_API_URL}/table/${tableId}/record`;
    
    console.log(`[DEBUG] Sending Bulk PATCH with Body Config to: ${url}`);
    
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fieldKeyType: 'id', // <--- זה התיקון! השרת יקרא את זה מכאן
        records: [
          {
            id: recordId,
            fields: fields
          }
        ]
      }),
    });
    
    if (!res.ok) {
        const errorText = await res.text(); 
        console.error(`Teable Update Failed.`, errorText);
        throw new Error(`Teable Error: ${errorText}`);
    }
    
    return await res.json();
  },

  // 4. מחיקה
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
