// lib/teable.ts

// נגדיר את המבנה של נסיעה כדי למנוע שגיאות
export interface Ride {
  id: string;
  date: string;
  time: string;
  pickup: string;
  dropoff: string;
  passengers: number;
  driverId?: string;
  status: string;
  notes?: string;
  price?: number;
  cost?: number;
}

const TEABLE_API_URL = 'https://app.teable.io/api';
const TABLE_ID = process.env.TEABLE_TABLE_ID;
const API_KEY = process.env.TEABLE_API_KEY;

// פונקציית עזר לבדיקת הגדרות
function getConfig() {
  if (!TABLE_ID || !API_KEY) {
    throw new Error('Missing TEABLE_TABLE_ID or TEABLE_API_KEY environment variables');
  }
  return { TABLE_ID, API_KEY };
}

// 1. שליפת כל הנסיעות (Get)
export async function getRides(): Promise<Ride[]> {
  const { TABLE_ID, API_KEY } = getConfig();

  const response = await fetch(`${TEABLE_API_URL}/table/${TABLE_ID}/record`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
    cache: 'no-store', // חשוב כדי לקבל מידע עדכני תמיד
  });

  if (!response.ok) {
    throw new Error('Failed to fetch rides');
  }

  const data = await response.json();

  // המרה של המידע מ-Teable למבנה שלנו
  return data.records.map((record: any) => ({
    id: record.id,
    date: record.fields['תאריך'] || '',
    time: record.fields['שעה'] || '',
    pickup: record.fields['מוצא'] || '',
    dropoff: record.fields['יעד'] || '',
    passengers: record.fields['נוסעים'] || 0,
    driverId: record.fields['נהג'] || '', 
    status: record.fields['סטטוס'] || 'ממתין',
    notes: record.fields['הערות'] || '',
    price: record.fields['מחיר'] || 0,
    cost: record.fields['עלות'] || 0,
  }));
}

// 2. יצירת נסיעה חדשה (Create)
export async function createRide(data: Partial<Ride>) {
  const { TABLE_ID, API_KEY } = getConfig();

  const fields: Record<string, any> = {
    'תאריך': data.date,
    'שעה': data.time,
    'מוצא': data.pickup,
    'יעד': data.dropoff,
    'נוסעים': Number(data.passengers),
    'סטטוס': data.status || 'ממתין',
  };

  // הוספת שדות אופציונליים רק אם קיימים
  if (data.driverId) fields['נהג'] = data.driverId;
  if (data.notes) fields['הערות'] = data.notes;
  if (data.price) fields['מחיר'] = Number(data.price);
  if (data.cost) fields['עלות'] = Number(data.cost);

  const response = await fetch(`${TEABLE_API_URL}/table/${TABLE_ID}/record`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      records: [{ fields }] // שים לב: Teable דורש מערך ביצירה
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Teable create error:', error);
    throw new Error('Failed to create ride');
  }

  return await response.json();
}

// 3. עדכון נסיעה קיימת (Update) - הפונקציה שהייתה חסרה לך
export async function updateRide(id: string, data: Partial<Ride>) {
  const { TABLE_ID, API_KEY } = getConfig();

  console.log('Updating Teable record:', id, data);

  const fields: Record<string, any> = {};
  
  // מיפוי שדות (מעדכן רק מה שנשלח)
  if (data.date) fields['תאריך'] = data.date;
  if (data.time) fields['שעה'] = data.time;
  if (data.pickup) fields['מוצא'] = data.pickup;
  if (data.dropoff) fields['יעד'] = data.dropoff;
  if (data.passengers) fields['נוסעים'] = Number(data.passengers);
  if (data.driverId) fields['נהג'] = data.driverId;
  if (data.status) fields['סטטוס'] = data.status;
  if (data.notes) fields['הערות'] = data.notes;
  if (data.price) fields['מחיר'] = Number(data.price);
  if (data.cost) fields['עלות'] = Number(data.cost);

  const response = await fetch(`${TEABLE_API_URL}/table/${TABLE_ID}/record/${id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      record: { fields } // שים לב: בעדכון זה record יחיד ולא מערך
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Teable update error:', error);
    throw new Error('Failed to update ride');
  }

  return await response.json();
}

// 4. מחיקת נסיעה (Delete)
export async function deleteRide(id: string) {
  const { TABLE_ID, API_KEY } = getConfig();

  const response = await fetch(`${TEABLE_API_URL}/table/${TABLE_ID}/record/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete ride');
  }

  return true;
}
