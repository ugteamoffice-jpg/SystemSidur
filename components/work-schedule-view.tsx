// components/work-schedule-view.tsx

"use client"

import { useEffect, useState } from "react"
// הערה: ודא שיש לך את הקובץ work-schedule-table.tsx שיצרנו קודם. 
// אם אין לך אותו, תגיד לי ואשלח גם אותו.
import { WorkScheduleTable } from "@/components/work-schedule-table" 
import { RideDialog } from "@/components/new-ride-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, RotateCcw, FileDown } from "lucide-react"
import { DatePickerWithRange } from "@/components/date-range-picker"
import { startOfMonth, endOfMonth } from "date-fns"
import { DateRange } from "react-day-picker"
import * as XLSX from 'xlsx'

export function WorkScheduleView() {
  const [data, setData] = useState<any[]>([])
  const [filteredData, setFilteredData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/work-schedule')
      const json = await res.json()
      const records = json.records || json || []
      setData(records)
    } catch (error) {
      console.error("Failed to load data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!data) return

    let res = [...data]

    // סינון תאריכים
    if (dateRange?.from) {
      const from = new Date(dateRange.from).setHours(0, 0, 0, 0)
      const to = dateRange.to ? new Date(dateRange.to).setHours(23, 59, 59, 999) : from

      res = res.filter(item => {
        const dateStr = item.fields['fldvNsQbfzMWTc7jakp']
        if (!dateStr) return false
        const itemDate = new Date(dateStr).getTime()
        return itemDate >= from && itemDate <= to
      })
    }

    // סינון חיפוש
    if (search) {
      const lower = search.toLowerCase()
      res = res.filter(item => {
        return Object.values(item.fields || {}).some((val: any) => {
          if (Array.isArray(val)) {
             return val.some(v => String(v.title || v).toLowerCase().includes(lower))
          }
          return String(val).toLowerCase().includes(lower)
        })
      })
    }
    
    // מיון
    res.sort((a, b) => {
       const dateA = a.fields['fldvNsQbfzMWTc7jakp'] || ''
       const dateB = b.fields['fldvNsQbfzMWTc7jakp'] || ''
       if (dateA !== dateB) return dateA.localeCompare(dateB)
       const timeA = a.fields['fldLbXMREYfC8XVIghj'] || ''
       const timeB = b.fields['fldLbXMREYfC8XVIghj'] || ''
       return timeA.localeCompare(timeB)
    })

    setFilteredData(res)
  }, [data, search, dateRange])

  const totals = filteredData.reduce((acc, curr) => {
    const f = curr.fields
    return {
      client: acc.client + (parseFloat(f['fldxXnfHHQWwXY8dlEV']) || 0),
      driver: acc.driver + (parseFloat(f['fldSNuxbM8oJfrQ3a9x']) || 0),
      profit: acc.profit + ((parseFloat(f['fldxXnfHHQWwXY8dlEV']) || 0) - (parseFloat(f['fldSNuxbM8oJfrQ3a9x']) || 0))
    }
  }, { client: 0, driver: 0, profit: 0 })

  const exportToExcel = () => {
    const rows = filteredData.map(r => {
        const f = r.fields;
        const getVal = (v: any) => Array.isArray(v) ? v[0]?.title : v;
        return {
            "תאריך": f['fldvNsQbfzMWTc7jakp'],
            "לקוח": getVal(f['fldVy6L2DCboXUTkjBX']),
            "תיאור": f['fldA6e7ul57abYgAZDh'],
            "נהג": getVal(f['flddNPbrzOCdgS36kx5']),
            "מחיר לקוח": f['fldxXnfHHQWwXY8dlEV'],
            "מחיר נהג": f['fldSNuxbM8oJfrQ3a9x']
        }
    })
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "סידור עבודה");
    XLSX.writeFile(wb, "סידור_עבודה.xlsx");
  }

  return (
    // כאן הסוד: flex-1 ותצוגת עמודה ממלאים את המקום שנשאר בתוך הטאב
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50" dir="rtl">
      
      {/* כותרת ופילטרים - קבועים למעלה */}
      <header className="bg-white border-b px-6 py-4 shadow-sm flex-none">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">סידור עבודה</h1>
            <p className="text-slate-500 text-sm">ניהול נסיעות ושיבוצים</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="חיפוש חופשי..." 
                className="pr-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <DatePickerWithRange date={dateRange} setDate={setDateRange} />
            <div className="flex gap-2 mr-auto md:mr-0">
               <Button variant="outline" size="icon" onClick={loadData} title="רענן נתונים">
                 <RotateCcw className="h-4 w-4" />
               </Button>
               <Button variant="outline" size="icon" onClick={exportToExcel} title="ייצוא לאקסל">
                 <FileDown className="h-4 w-4" />
               </Button>
               <RideDialog onRideSaved={loadData} defaultDate={dateRange?.from} />
            </div>
          </div>
        </div>
      </header>

      {/* אזור הטבלה - נגלל בפני עצמו */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="bg-white rounded-lg border shadow-sm min-h-full">
            <WorkScheduleTable 
                data={filteredData} 
                onEdit={loadData} 
                loading={loading}
            />
        </div>
      </main>

      {/* פוטר סיכומים - קבוע למטה */}
      <footer className="bg-white border-t p-4 flex-none shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
        <div className="max-w-screen-xl mx-auto flex flex-wrap justify-center md:justify-end gap-4 md:gap-8 text-sm">
           <div className="flex flex-col items-center">
             <span className="text-slate-500 font-medium">סה"כ נסיעות</span>
             <span className="text-lg font-bold">{filteredData.length}</span>
           </div>
           <div className="h-10 w-px bg-slate-200 hidden md:block"></div>
           <div className="flex flex-col items-center">
             <span className="text-slate-500 font-medium">הכנסות (לקוח)</span>
             <span className="text-lg font-bold text-blue-600">₪{totals.client.toLocaleString()}</span>
           </div>
           <div className="flex flex-col items-center">
             <span className="text-slate-500 font-medium">הוצאות (נהג)</span>
             <span className="text-lg font-bold text-orange-600">₪{totals.driver.toLocaleString()}</span>
           </div>
           <div className="h-10 w-px bg-slate-200 hidden md:block"></div>
           <div className="flex flex-col items-center">
             <span className="text-slate-500 font-medium">רווח משוער</span>
             <span className={`text-xl font-black ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
               ₪{totals.profit.toLocaleString()}
             </span>
           </div>
        </div>
      </footer>
    </div>
  )
}
