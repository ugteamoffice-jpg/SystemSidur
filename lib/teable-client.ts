// lib/teable-client.ts

// הגדרת הכתובת הבסיסית בצורה קשיחה כדי למנוע טעויות
const BASE_URL = 'https://teable-production-bedd.up.railway.app';
const TEABLE_API_URL = `${BASE_URL}/api`;

const API_KEY = process.env.TEABLE_API_KEY;

export const teableClient = {
  
  // שליפת נתונים
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

  // יצירת רשומה חדשה
  async createRecord(tableId: string, fields: any) {
    if (!API_KEY) throw new Error('Missing TEABLE_API_KEY');
    
    // *** שים לב: הוספתי ?fieldKeyType=id ***
    const url = `${TEABLE_API_URL}/table/${tableId}/record?fieldKeyType=id`;
    
    const res = await fetch(url, {
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

  // עדכון רשומה (כאן הייתה הבעיה שלך!)
  async updateRecord(tableId: string, recordId: string, fields: any) {
    if (!API_KEY) throw new Error('Missing TEABLE_API_KEY');

    // *** התיקון הקריטי: ?fieldKeyType=id ***
    // זה אומר ל-Teable: "אני שולח לך IDs, אל תחפש שמות!"
    const fullUrl = `${TEABLE_API_URL}/table/${tableId}/record/${recordId}?fieldKeyType=id`;
    
    console.log(`[DEBUG] Sending PATCH to: ${fullUrl}`); // לוג לוודא שהתיקון עובד
    
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
        console.error(`Teable Update Failed. URL: ${fullUrl}`, errorText);
        throw new Error(`Teable Error: ${errorText}`);
    }
    
    return await res.json();
  },

  // מחיקת רשומה
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
