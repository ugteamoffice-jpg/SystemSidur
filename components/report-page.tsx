"use client"

import * as React from "react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { Calendar as CalendarIcon, Loader2, Search, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useTenantFields, useTenant } from "@/lib/tenant-context"

interface WorkScheduleRecord {
  id: string
  fields: { [key: string]: any }
}

type ReportType = "report-customer" | "report-driver" | "report-invoices" | "report-profit"

interface ReportPageProps {
  reportType: ReportType
}

const renderLinkField = (value: any): string => {
  if (!value) return "-"
  if (Array.isArray(value) && value.length > 0) return value[0]?.title || "-"
  if (typeof value === "object" && value.title) return value.title
  return String(value)
}

export function ReportPage({ reportType }: ReportPageProps) {
  const tenantFields = useTenantFields()
  const { tenantId } = useTenant()
  const WS = tenantFields?.workSchedule || ({} as any)

  const [allData, setAllData] = React.useState<WorkScheduleRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [hasSearched, setHasSearched] = React.useState(false)

  // Filters
  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const [startDate, setStartDate] = React.useState<Date | undefined>(firstOfMonth)
  const [endDate, setEndDate] = React.useState<Date | undefined>(today)
  const [startCalOpen, setStartCalOpen] = React.useState(false)
  const [endCalOpen, setEndCalOpen] = React.useState(false)
  const [filterName, setFilterName] = React.useState("")

  const [scrollTop, setScrollTop] = React.useState(0)
  const [containerHeight, setContainerHeight] = React.useState(600)
  const tableContainerRef = React.useRef<HTMLDivElement>(null)
  const ROW_HEIGHT = 45
  const BUFFER_SIZE = 10

  const reportTitle = {
    "report-customer": "דוח לקוח",
    "report-driver": "דוח נהג",
    "report-invoices": "דוח חשבוניות",
    "report-profit": "דוח רווח והפסד",
  }[reportType]

  const filterLabel = reportType === "report-driver" ? "שם נהג" : "שם לקוח"

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/work-schedule?take=5000&_t=${Date.now()}`)
      if (!response.ok) throw new Error("Failed to fetch")
      const json = await response.json()
      setAllData(json.records || [])
      setHasSearched(true)
    } catch (error) {
      console.error("Error fetching report data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Filter data
  const filteredData = React.useMemo(() => {
    let filtered = allData

    // Date range filter
    if (startDate) {
      const startStr = format(startDate, "yyyy-MM-dd")
      filtered = filtered.filter((item) => {
        const d = item.fields[WS.DATE] || ""
        return d >= startStr
      })
    }
    if (endDate) {
      const endStr = format(endDate, "yyyy-MM-dd")
      filtered = filtered.filter((item) => {
        const d = item.fields[WS.DATE] || ""
        return d <= endStr
      })
    }

    // Name filter
    if (filterName.trim()) {
      const search = filterName.trim().toLowerCase()
      if (reportType === "report-driver") {
        filtered = filtered.filter((item) => {
          const driver = renderLinkField(item.fields[WS.DRIVER])
          return driver.toLowerCase().includes(search)
        })
      } else {
        filtered = filtered.filter((item) => {
          const customer = renderLinkField(item.fields[WS.CUSTOMER])
          return customer.toLowerCase().includes(search)
        })
      }
    }

    // Sort by date
    filtered.sort((a, b) => {
      const da = a.fields[WS.DATE] || ""
      const db = b.fields[WS.DATE] || ""
      return da.localeCompare(db)
    })

    return filtered
  }, [allData, startDate, endDate, filterName, reportType, WS])

  // Totals
  const totals = React.useMemo(() => {
    return {
      totalRows: filteredData.length,
      p1: filteredData.reduce((sum, r) => sum + (Number(r.fields[WS.PRICE_CLIENT_EXCL]) || 0), 0),
      p2: filteredData.reduce((sum, r) => sum + (Number(r.fields[WS.PRICE_CLIENT_INCL]) || 0), 0),
      p3: filteredData.reduce((sum, r) => sum + (Number(r.fields[WS.PRICE_DRIVER_EXCL]) || 0), 0),
      p4: filteredData.reduce((sum, r) => sum + (Number(r.fields[WS.PRICE_DRIVER_INCL]) || 0), 0),
      p5: filteredData.reduce((sum, r) => sum + (Number(r.fields[WS.PROFIT]) || 0), 0),
      p6: filteredData.reduce(
        (sum, r) =>
          sum + ((Number(r.fields[WS.PRICE_CLIENT_INCL]) || 0) - (Number(r.fields[WS.PRICE_DRIVER_INCL]) || 0)),
        0
      ),
    }
  }, [filteredData, WS])

  // Virtual scroll
  React.useEffect(() => {
    if (tableContainerRef.current) {
      setContainerHeight(tableContainerRef.current.clientHeight)
    }
  }, [])

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_SIZE)
  const endIndex = Math.min(filteredData.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + BUFFER_SIZE)
  const visibleRows = filteredData.slice(startIndex, endIndex)
  const totalHeight = filteredData.length * ROW_HEIGHT
  const offsetY = startIndex * ROW_HEIGHT

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }

  return (
    <div className="w-full h-full flex flex-col p-4 space-y-3 overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2 flex-none">
        <FileText className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">{reportTitle}</h2>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-none flex-wrap">
        {/* Start date */}
        <Popover open={startCalOpen} onOpenChange={setStartCalOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[180px] justify-start text-right font-normal">
              <CalendarIcon className="ml-2 h-4 w-4" />
              {startDate ? format(startDate, "dd/MM/yyyy") : "מתאריך"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={(d) => { setStartDate(d); setStartCalOpen(false) }}
              locale={he}
              dir="rtl"
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* End date */}
        <Popover open={endCalOpen} onOpenChange={setEndCalOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[180px] justify-start text-right font-normal">
              <CalendarIcon className="ml-2 h-4 w-4" />
              {endDate ? format(endDate, "dd/MM/yyyy") : "עד תאריך"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={(d) => { setEndDate(d); setEndCalOpen(false) }}
              locale={he}
              dir="rtl"
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Name filter */}
        {(reportType === "report-customer" || reportType === "report-driver") && (
          <div className="relative w-[220px]">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={filterLabel}
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              className="pr-10"
            />
          </div>
        )}

        {/* Search button */}
        <Button onClick={fetchData} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Search className="h-4 w-4 ml-2" />}
          הצג דוח
        </Button>

        {/* Totals summary */}
        {hasSearched && filteredData.length > 0 && (
          <>
            <div className="flex bg-card p-2 px-4 rounded-md border shadow-sm items-center gap-4 whitespace-nowrap mr-auto">
              <span className="text-muted-foreground text-xs font-medium">
                סה"כ שורות: <span className="font-bold text-foreground text-sm">{totals.totalRows}</span>
              </span>
            </div>

            <div className="flex gap-4 text-xs bg-muted/20 p-2 px-4 rounded-md border shadow-sm items-center whitespace-nowrap">
              <div className="flex flex-col gap-1 items-start">
                <span>
                  לקוח+ מע"מ: <span className="font-bold text-sm">{totals.p1.toLocaleString()} ₪</span>
                </span>
                <span>
                  לקוח כולל מע"מ: <span className="font-bold text-sm">{totals.p2.toLocaleString()} ₪</span>
                </span>
              </div>
              <div className="w-px bg-border self-stretch my-1"></div>
              <div className="flex flex-col gap-1 items-start">
                <span>
                  נהג+ מע"מ: <span className="font-bold text-sm">{totals.p3.toLocaleString()} ₪</span>
                </span>
                <span>
                  נהג כולל מע"מ: <span className="font-bold text-sm">{totals.p4.toLocaleString()} ₪</span>
                </span>
              </div>
              <div className="w-px bg-border self-stretch my-1"></div>
              <div className="flex flex-col gap-1 items-start text-green-600 dark:text-green-400 font-medium">
                <span>
                  רווח+ מע"מ: <span className="font-bold text-sm">{totals.p5.toLocaleString()} ₪</span>
                </span>
                <span>
                  רווח כולל מע"מ: <span className="font-bold text-sm">{totals.p6.toLocaleString()} ₪</span>
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Table */}
      <div
        ref={tableContainerRef}
        className="border rounded-lg flex-1 overflow-auto bg-background shadow-sm"
        onScroll={handleScroll}
      >
        {!hasSearched && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>בחר טווח תאריכים ולחץ "הצג דוח"</p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="mr-2 text-muted-foreground">טוען נתונים...</span>
          </div>
        )}

        {hasSearched && !isLoading && filteredData.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>לא נמצאו תוצאות</p>
          </div>
        )}

        {hasSearched && !isLoading && filteredData.length > 0 && (
          <Table style={{ tableLayout: "fixed" }}>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
              <TableRow>
                <TableHead className="text-right pr-4 w-[100px]">תאריך</TableHead>
                <TableHead className="text-right w-[140px]">שם לקוח</TableHead>
                <TableHead className="text-right w-[90px]">התייצבות</TableHead>
                <TableHead className="text-right w-[180px]">מסלול</TableHead>
                <TableHead className="text-right w-[90px]">חזור</TableHead>
                <TableHead className="text-right w-[100px]">סוג רכב</TableHead>
                <TableHead className="text-right w-[120px]">שם נהג</TableHead>
                <TableHead className="text-right w-[90px]">מספר רכב</TableHead>
                <TableHead className="text-right w-[120px]">לקוח+ מע״מ</TableHead>
                <TableHead className="text-right w-[130px]">לקוח כולל מע״מ</TableHead>
                <TableHead className="text-right w-[120px]">נהג+ מע״מ</TableHead>
                <TableHead className="text-right w-[130px]">נהג כולל מע״מ</TableHead>
                <TableHead className="text-right w-[90px]">רווח</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {startIndex > 0 && (
                <tr style={{ height: `${offsetY}px` }}>
                  <td colSpan={13} />
                </tr>
              )}
              {visibleRows.map((record) => (
                <TableRow key={record.id} style={{ height: `${ROW_HEIGHT}px` }}>
                  <TableCell className="text-right pr-4 truncate">
                    {record.fields[WS.DATE]
                      ? format(new Date(record.fields[WS.DATE]), "dd/MM/yyyy")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right truncate">
                    {renderLinkField(record.fields[WS.CUSTOMER])}
                  </TableCell>
                  <TableCell className="text-right truncate">
                    {record.fields[WS.PICKUP_TIME] || "-"}
                  </TableCell>
                  <TableCell className="text-right truncate" title={record.fields[WS.DESCRIPTION]}>
                    {record.fields[WS.DESCRIPTION] || "-"}
                  </TableCell>
                  <TableCell className="text-right truncate">
                    {record.fields[WS.DROPOFF_TIME] || "-"}
                  </TableCell>
                  <TableCell className="text-right truncate">
                    {renderLinkField(record.fields[WS.VEHICLE_TYPE])}
                  </TableCell>
                  <TableCell className="text-right truncate">
                    {renderLinkField(record.fields[WS.DRIVER])}
                  </TableCell>
                  <TableCell className="text-right truncate">
                    {record.fields[WS.VEHICLE_NUM] || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {(Number(record.fields[WS.PRICE_CLIENT_EXCL]) || 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {(Number(record.fields[WS.PRICE_CLIENT_INCL]) || 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {(Number(record.fields[WS.PRICE_DRIVER_EXCL]) || 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {(Number(record.fields[WS.PRICE_DRIVER_INCL]) || 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-green-600 dark:text-green-400 font-medium">
                    {(Number(record.fields[WS.PROFIT]) || 0).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {endIndex < filteredData.length && (
                <tr style={{ height: `${totalHeight - endIndex * ROW_HEIGHT}px` }}>
                  <td colSpan={13} />
                </tr>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
