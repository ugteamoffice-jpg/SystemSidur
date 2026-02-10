// lib/teable-client.ts

const TEABLE_API_URL = 'https://app.teable.io/api';
const API_KEY = process.env.TEABLE_API_KEY;

// זה האובייקט שהקבצים האחרים מחפשים (חייב להיות const teableClient)
export const teableClient = {
  
  // פונקציה לשליפת רשומות
  async getRecords(tableId: string, query?: any) {
    if (!API_KEY) throw new Error('Missing TEABLE_API_KEY');
    
    const url = new URL(`${TEABLE_API_URL}/table/${tableId}/record`);
    if (query) {
      Object.keys(query).forEach(key => url.searchParams.append(key, query[key]));
    }

    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
      cache: 'no-store'
    });
    
    if (!res.ok) throw new Error(`Failed to fetch records from table ${tableId}`);
    return await res.json();
  },

  // פונקציה ליצירת רשומה
  async createRecord(tableId: string, fields: any) {
    if (!API_KEY) throw new Error('Missing TEABLE_API_KEY');

    const res = await fetch(`${TEABLE_API_URL}/table/${tableId}/record`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        records: [{ fields }]
      }),
    });
    
    if (!res.ok) throw new Error(`Failed to create record in table ${tableId}`);
    return await res.json();
  },

  // פונקציה לעדכון רשומה
  async updateRecord(tableId: string, recordId: string, fields: any) {
    if (!API_KEY) throw new Error('Missing TEABLE_API_KEY');

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
    
    if (!res.ok) throw new Error(`Failed to update record ${recordId}`);
    return await res.json();
  },

  // פונקציה למחיקת רשומה
  async deleteRecord(tableId: string, recordId: string) {
    if (!API_KEY) throw new Error('Missing TEABLE_API_KEY');

    const res = await fetch(`${TEABLE_API_URL}/table/${tableId}/record/${recordId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });
    
    if (!res.ok) throw new Error(`Failed to delete record ${recordId}`);
    return true;
  }
};
