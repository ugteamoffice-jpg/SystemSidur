export interface WorkScheduleRecord {
  id: string
  fields: {
    [key: string]: any
    fldvNsQbfzMWTc7jakp?: string // תאריך
    fldLbXMREYfC8XVIghj?: string // התייצבות
    fldA6e7ul57abYgAZDh?: string // תיאור
    fld56G8M1LyHRRROWiL?: string // חזור
    fldMv14lt0W7ZBkq1PH?: boolean // שלח
    fldDOBGATSaTi5TxyHB?: boolean // מאושר
    fldxXnfHHQWwXY8dlEV?: number // מחיר לקוח+ מע"מ
    fldT7QLSKmSrjIHarDb?: number // מחיר לקוח כולל מע"מ
    fldxZmnQzflBG9M0RYq?: number // תאריך ושעה העלאת קובץ (שדה מע"מ המקורי לא ברשימה, הנחתי שזה או זה או חסר)
    fldSNuxbM8oJfrQ3a9x?: number // מחיר נהג+ מע"מ
    fldyQIhjdUeQwtHMldD?: number // מחיר נהג כולל מע"מ
    fldhNoiFEkEgrkxff02?: string // הערות לנהג
    fldelKu7PLIBmCFfFPJ?: string // הערות מנהל
    fldkvTaql1bPbifVKLt?: string // שם מזמין
    fld6NJPsiW8CtRIfnaY?: number // טלפון נייד
    fldAJPcCFUcDPlSCK1a?: number // ת"ז
    fldVy6L2DCboXUTkjBX?: any // שם לקוח (link)
    fldx4hl8FwbxfkqXf0B?: any // סוג רכב (link)
    flddNPbrzOCdgS36kx5?: any // שם נהג (link)
    fldqStJV3KKIutTY9hW?: string // מספר רכב
    fldKkq5oyBm8CwcAIvH?: any // טופס הזמנה (קובץ)
  }
  createdTime?: string
  lastModifiedTime?: string
}

export interface TableSchema {
  id: string
  name: string
  fields: Array<{
    id: string
    name: string
    type: string
    cellValueType: string
    isComputed?: boolean
    options?: any
  }>
}
