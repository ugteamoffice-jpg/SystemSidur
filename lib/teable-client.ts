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
    
    const res = await fetch(`${TEABLE_API_URL}/table/${tableId}/record`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fieldKeyType: 'id',
        typecast: true,
        records: [{ fields }] 
      }),
    });
    
    if (!res.ok) {
        const err = await res.text();
        console.error("Teable Create Error:", err);
        throw new Error(`Teable Create Error: ${err}`);
    }
    
    // תיקון: מחזירים רק את הרשומה הראשונה מתוך המערך
    const data = await res.json();
    if (data.records && Array.isArray(data.records)) {
        return data.records[0];
    }
    return data;
  },

  // 3. עדכון
  async updateRecord(tableId: string, recordId: string, fields: any) {
    if (!API_KEY) throw new Error('Missing TEABLE_API_KEY');

    const url = `${TEABLE_API_URL}/table/${tableId}/record`;
    
    console.log(`[DEBUG] Update Record: ${recordId}`);
    
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fieldKeyType: 'id',
        typecast: true,
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
    
    const data = await res.json();
    
    // *** התיקון הקריטי כאן ***
    // Teable מחזיר מערך בגלל שהשתמשנו ב-Bulk Update.
    // אנחנו שולפים את הרשומה הראשונה ומחזירים רק אותה, כדי שהאתר לא יתבלבל.
    if (data.records && Array.isArray(data.records) && data.records.length > 0) {
        return data.records[0];
    }
    
    return data;
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
