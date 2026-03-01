"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, XCircle, CheckCircle, Search, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useTenantFields, useTenant } from "@/lib/tenant-context"

interface Customer {
  id: string
  fields: {
    [key: string]: any
  }
}

export default function CustomersGrid() {
  const tenantFields = useTenantFields()
  const { tenantId } = useTenant()
  const C = tenantFields?.customers
  const STATUS_FIELD_ID = C?.STATUS || ""
  const CREATED_IN_ACCOUNTING_ID = C?.CREATED_IN_ACCOUNTING || ""
  const ACCOUNTING_KEY_NUMBER_ID = C?.ACCOUNTING_KEY || ""
  const ONGOING_PAYMENT_ID = C?.ONGOING_PAYMENT || ""
  const NAME_ID = C?.NAME || ""
  const HP_ID = C?.HP || ""
  const CONTACT_NAME_ID = C?.CONTACT_NAME || ""
  const PHONE_ID = C?.PHONE || ""
  const EMAIL_ID = C?.EMAIL || ""
  const PAYMENT_METHOD_ID = C?.PAYMENT_METHOD || ""

  const [customers, setCustomers] = useState<Customer[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"פעיל" | "לא פעיל">("פעיל")
  const [emailError, setEmailError] = useState("")
  const [hpError, setHpError] = useState("")
  const [phoneError, setPhoneError] = useState("")
  const [accountingKeyError, setAccountingKeyError] = useState("")
  const [ongoingPaymentError, setOngoingPaymentError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(600)
  const tableContainerRef = useRef<HTMLDivElement>(null)

  const ROW_HEIGHT = 53
  const BUFFER_SIZE = 10 

  const CUSTOMERS_COL_SIZING_KEY = `customersColumnSizing_${tenantId}`
  const customerColumns = [
    { key: 'name', header: 'שם לקוח', defaultWidth: 200, minWidth: 100 },
    { key: 'hp', header: 'ח.פ', defaultWidth: 120, minWidth: 80 },
    { key: 'contact', header: 'שם א.קשר', defaultWidth: 120, minWidth: 80 },
    { key: 'phone', header: 'טלפון נייד', defaultWidth: 120, minWidth: 80 },
    { key: 'email', header: 'אימייל', defaultWidth: 200, minWidth: 100 },
    { key: 'payment', header: 'אופן תשלום', defaultWidth: 130, minWidth: 80 },
    { key: 'ongoing', header: 'תשלום שוטף+', defaultWidth: 120, minWidth: 80 },
    { key: 'accKey', header: 'מס\' מפתח הנה"ח', defaultWidth: 130, minWidth: 80 },
    { key: 'accCreated', header: 'נוצר בהנה"ח', defaultWidth: 110, minWidth: 70 },
    { key: 'status', header: 'סטטוס', defaultWidth: 90, minWidth: 70 },
  ]

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(CUSTOMERS_COL_SIZING_KEY)
        if (saved) return JSON.parse(saved)
      } catch (e) {}
    }
    return {}
  })

  useEffect(() => {
    if (typeof window !== 'undefined' && Object.keys(columnWidths).length > 0) {
      try { localStorage.setItem(CUSTOMERS_COL_SIZING_KEY, JSON.stringify(columnWidths)) } catch (e) {}
    }
  }, [columnWidths])

  const getColWidth = (col: typeof customerColumns[0]) => columnWidths[col.key] || col.defaultWidth

  const handleResizeStart = (colKey: string, minWidth: number, e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    const startX = e.clientX
    const startWidth = columnWidths[colKey] || customerColumns.find(c => c.key === colKey)!.defaultWidth
    const onMouseMove = (me: MouseEvent) => {
      const newWidth = Math.max(minWidth, startWidth + (startX - me.clientX))
      setColumnWidths(old => ({ ...old, [colKey]: newWidth }))
    }
    const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp) }
    document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp)
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    setIsLoading(true)
    setCustomers([])
    
    try {
      const response = await fetch(`/api/customers?tenant=${tenantId}`);
      if (!response.ok) throw new Error("Fetch failed");
      
      const data = await response.json();
      const records = data.records || [];
      
      setCustomers(records);
      console.log(`✅ Loaded ${records.length} customers`);
    } catch (error) {
      console.error("Error fetching customers:", error)
      toast({ title: "שגיאה בטעינה", description: "חלק מהנתונים אולי לא נטענו", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateCustomer = async () => {
    try {
      const filteredFields = Object.entries(newCustomer).reduce((acc, [key, value]) => {
        if (value !== "" && value !== undefined && value !== null) acc[key] = value
        return acc
      }, {} as any)
      filteredFields[STATUS_FIELD_ID] = "פעיל"
      const response = await fetch(`/api/customers?tenant=${tenantId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: filteredFields }) })
      if (!response.ok) throw new Error("Failed")
      toast({ title: "הצלחה", description: "נוצר בהצלחה" })
      setIsDialogOpen(false); resetForm(); fetchCustomers();
    } catch (error) { toast({ title: "שגיאה", description: "נכשל", variant: "destructive" }) }
  }

  const handleUpdateCustomer = async () => {
    if (!editingCustomerId) return
    try {
      const filteredFields = Object.entries(newCustomer).reduce((acc, [key, value]) => {
        if (value !== "" && value !== undefined && value !== null) acc[key] = value
        return acc
      }, {} as any)
      const response = await fetch(`/api/customers?tenant=${tenantId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recordId: editingCustomerId, fields: filteredFields }) })
      if (!response.ok) throw new Error("Failed")
      toast({ title: "הצלחה", description: "עודכן בהצלחה" })
      setIsDialogOpen(false); setEditingCustomerId(null); resetForm();
      setCustomers(prev => prev.map(c => c.id === editingCustomerId ? { ...c, fields: { ...c.fields, ...filteredFields } } : c));
    } catch (error) { toast({ title: "שגיאה", description: "נכשל", variant: "destructive" }) }
  }

  const handleDeleteCustomer = async () => {
    if (!editingCustomerId) return
    try {
      const newStatus = (newCustomer[STATUS_FIELD_ID] || "פעיל") === "לא פעיל" ? "פעיל" : "לא פעיל"
      const response = await fetch(`/api/customers?tenant=${tenantId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recordId: editingCustomerId, fields: { [STATUS_FIELD_ID]: newStatus } }) })
      if (!response.ok) throw new Error("Failed")
      setIsDialogOpen(false); setEditingCustomerId(null); resetForm(); 
      setCustomers(prev => prev.map(c => c.id === editingCustomerId ? { ...c, fields: { ...c.fields, [STATUS_FIELD_ID]: newStatus } } : c));
      toast({ title: "הצלחה", description: "סטטוס עודכן" })
    } catch (error) { toast({ title: "שגיאה", description: "נכשל", variant: "destructive" }) }
  }

  const handleRowClick = (customer: Customer) => { 
    setEditingCustomerId(customer.id); 
    setNewCustomer({ 
      [NAME_ID]: customer.fields[NAME_ID] || "",
      [HP_ID]: customer.fields[HP_ID] || "",
      [CONTACT_NAME_ID]: customer.fields[CONTACT_NAME_ID] || "",
      [PHONE_ID]: customer.fields[PHONE_ID] || "",
      [EMAIL_ID]: customer.fields[EMAIL_ID] || "",
      [PAYMENT_METHOD_ID]: customer.fields[PAYMENT_METHOD_ID] || "",
      [CREATED_IN_ACCOUNTING_ID]: customer.fields[CREATED_IN_ACCOUNTING_ID] || false,
      [ACCOUNTING_KEY_NUMBER_ID]: customer.fields[ACCOUNTING_KEY_NUMBER_ID] || "",
      [ONGOING_PAYMENT_ID]: customer.fields[ONGOING_PAYMENT_ID] || "",
      [STATUS_FIELD_ID]: customer.fields[STATUS_FIELD_ID] || "פעיל"
    } as any); 
    setIsDialogOpen(true) 
  }

  const resetForm = () => { 
    setNewCustomer({ 
      [NAME_ID]: "", 
      [HP_ID]: "", 
      [CONTACT_NAME_ID]: "", 
      [PHONE_ID]: "", 
      [EMAIL_ID]: "", 
      [PAYMENT_METHOD_ID]: "",
      [CREATED_IN_ACCOUNTING_ID]: false,
      [ACCOUNTING_KEY_NUMBER_ID]: "",
      [ONGOING_PAYMENT_ID]: ""
    }); 
    setEmailError(""); 
    setHpError("");
    setPhoneError("");
    setAccountingKeyError("");
    setOngoingPaymentError("");
  }

  const [newCustomer, setNewCustomer] = useState<any>({ 
    [NAME_ID]: "", 
    [HP_ID]: "", 
    [CONTACT_NAME_ID]: "", 
    [PHONE_ID]: "", 
    [EMAIL_ID]: "", 
    [PAYMENT_METHOD_ID]: "",
    [CREATED_IN_ACCOUNTING_ID]: false,
    [ACCOUNTING_KEY_NUMBER_ID]: "",
    [ONGOING_PAYMENT_ID]: ""
  })

  const filteredCustomers = customers.filter((customer) => {
    const status = customer.fields[STATUS_FIELD_ID] || "פעיל"
    const matchesStatus = status === statusFilter
    if (!searchQuery) return matchesStatus
    const searchLower = searchQuery.toLowerCase()
    return matchesStatus && Object.values(customer.fields).some((value) => String(value).toLowerCase().includes(searchLower))
  })
  
  const isEditMode = !!editingCustomerId
  const getCustomerStatus = (customer: Customer) => customer.fields[STATUS_FIELD_ID] || "פעיל"
  
  const validateEmail = (email: string) => { 
    if (!email) { setEmailError(""); return true }; 
    if (/[\u0590-\u05FF]/.test(email)) { setEmailError("אנגלית בלבד"); return false }; 
    if (!email.includes("@")) { setEmailError("חסר @"); return false }; 
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) { setEmailError("פורמט מייל שגוי"); return false }; 
    setEmailError(""); 
    return true 
  }

  const validateHP = (hp: string) => {
    if (!hp) { setHpError(""); return true };
    if (!/^\d+$/.test(hp)) { setHpError("מספרים בלבד"); return false };
    if (hp.length !== 9) { setHpError("ח.פ חייב להכיל 9 ספרות"); return false };
    // בדיקת כפילות — לקוח אחר (לא הנערך כרגע)
    const duplicate = customers.find(c => c.id !== editingCustomerId && c.fields[HP_ID] === hp)
    if (duplicate) { setHpError(`ח.פ קיים כבר אצל: ${duplicate.fields[NAME_ID] || "לקוח אחר"}`); return false };
    setHpError("");
    return true;
  }

  const validatePhone = (phone: string) => {
    if (!phone) { setPhoneError(""); return true };
    if (!/^\d+$/.test(phone)) { setPhoneError("מספרים בלבד"); return false };
    if (phone.length < 9 || phone.length > 10) { setPhoneError("9-10 ספרות"); return false };
    setPhoneError("");
    return true;
  }

  const validateAccountingKey = (key: string) => {
    if (!key) { setAccountingKeyError(""); return true };
    if (!/^\d+$/.test(key)) { setAccountingKeyError("מספרים בלבד"); return false };
    setAccountingKeyError("");
    return true;
  }

  const validateOngoingPayment = (payment: string) => {
    if (!payment) { setOngoingPaymentError(""); return true };
    if (!/^\d+$/.test(payment)) { setOngoingPaymentError("מספרים בלבד"); return false };
    setOngoingPaymentError("");
    return true;
  }

  const handleHPChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    setNewCustomer({...newCustomer, [HP_ID]: numericValue});
    validateHP(numericValue);
  }

  const handlePhoneChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    setNewCustomer({...newCustomer, [PHONE_ID]: numericValue});
    validatePhone(numericValue);
  }

  const handleAccountingKeyChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    setNewCustomer({...newCustomer, [ACCOUNTING_KEY_NUMBER_ID]: numericValue});
    validateAccountingKey(numericValue);
  }

  const handleOngoingPaymentChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    setNewCustomer({...newCustomer, [ONGOING_PAYMENT_ID]: numericValue});
    validateOngoingPayment(numericValue);
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => { setScrollTop(e.currentTarget.scrollTop) }
  useEffect(() => { if (tableContainerRef.current) setContainerHeight(tableContainerRef.current.clientHeight) }, [])

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_SIZE)
  const endIndex = Math.min(filteredCustomers.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + BUFFER_SIZE)
  const visibleCustomers = filteredCustomers.slice(startIndex, endIndex)
  const totalHeight = filteredCustomers.length * ROW_HEIGHT
  const offsetY = startIndex * ROW_HEIGHT

  return (
    <div className="w-full h-[calc(100vh-2rem)] flex flex-col space-y-2 p-4 overflow-hidden" dir="rtl">
      <div className="flex items-center gap-3 flex-none flex-wrap">
        <Select value={statusFilter} onValueChange={(value: "פעיל" | "לא פעיל") => setStatusFilter(value)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="פעיל">פעיל</SelectItem><SelectItem value="לא פעיל">לא פעיל</SelectItem></SelectContent>
        </Select>
        <Button onClick={() => setIsDialogOpen(true)}><Plus className="h-4 w-4 ml-2" /> לקוח חדש</Button>
        <div className="relative w-[300px]">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="חיפוש..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10" />
        </div>
        <div className="mr-auto text-sm text-muted-foreground whitespace-nowrap flex items-center gap-2">
            {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            סה"כ {filteredCustomers.length.toLocaleString("he-IL")} לקוחות
        </div>
      </div>

      <div className="border rounded-lg flex-1 overflow-auto bg-background shadow-sm relative" ref={tableContainerRef} onScroll={handleScroll}>
        <Table style={{ tableLayout: 'fixed' }}>
          <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
            <TableRow>
              {customerColumns.map(col => (
                <TableHead key={col.key} className="text-right relative border-l select-none group hover:bg-muted/30" style={{ width: getColWidth(col) }}>
                  {col.header}
                  <div
                    onMouseDown={(e) => handleResizeStart(col.key, col.minWidth, e)}
                    className="absolute left-0 top-0 h-full w-1 cursor-col-resize touch-none select-none z-20 hover:bg-primary transition-colors duration-200"
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && filteredCustomers.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8"><div className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /><span>טוען נתונים...</span></div></TableCell></TableRow>
            ) : filteredCustomers.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">לא נמצאו לקוחות</TableCell></TableRow>
            ) : (
              <>
                {startIndex > 0 && <tr style={{ height: `${offsetY}px` }}><td colSpan={10} /></tr>}
                {visibleCustomers.map((customer) => (
                  <TableRow key={customer.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleRowClick(customer)} style={{ height: `${ROW_HEIGHT}px` }}>
                    <TableCell className="font-medium truncate">{customer.fields[NAME_ID] || "-"}</TableCell>
                    <TableCell className="truncate">{customer.fields[HP_ID] || "-"}</TableCell>
                    <TableCell className="truncate">{customer.fields[CONTACT_NAME_ID] || "-"}</TableCell>
                    <TableCell className="truncate">{customer.fields[PHONE_ID] || "-"}</TableCell>
                    <TableCell className="truncate">{customer.fields[EMAIL_ID] || "-"}</TableCell>
                    <TableCell className="truncate">{customer.fields[PAYMENT_METHOD_ID] || "-"}</TableCell>
                    <TableCell className="truncate">{customer.fields[ONGOING_PAYMENT_ID] || "-"}</TableCell>
                    <TableCell className="truncate">{customer.fields[ACCOUNTING_KEY_NUMBER_ID] || "-"}</TableCell>
                    <TableCell className="truncate">{customer.fields[CREATED_IN_ACCOUNTING_ID] ? "כן" : "לא"}</TableCell>
                    <TableCell><span className={`px-2 py-1 rounded-full text-xs ${getCustomerStatus(customer) === 'פעיל' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{getCustomerStatus(customer)}</span></TableCell>
                  </TableRow>
                ))}
                {endIndex < filteredCustomers.length && <tr style={{ height: `${totalHeight - endIndex * ROW_HEIGHT}px` }}><td colSpan={10} /></tr>}
              </>
            )}
          </TableBody>
        </Table>
      </div>
      
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setEditingCustomerId(null); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader><DialogTitle>{isEditMode ? "עריכת לקוח" : "לקוח חדש"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>שם לקוח {!isEditMode && <span className="text-red-500">*</span>}</Label>
                  <Input value={newCustomer[NAME_ID]} onChange={(e) => setNewCustomer({...newCustomer, [NAME_ID]: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>ח.פ</Label>
                  <Input 
                    value={newCustomer[HP_ID] || ""} 
                    onChange={(e) => handleHPChange(e.target.value)}
                    className={hpError ? "border-red-500" : ""}
                  />
                  {hpError && <p className="text-sm text-red-500">{hpError}</p>}
                </div>
                <div className="space-y-2">
                  <Label>שם א.קשר</Label>
                  <Input value={newCustomer[CONTACT_NAME_ID]} onChange={(e) => setNewCustomer({...newCustomer, [CONTACT_NAME_ID]: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>טלפון נייד</Label>
                  <Input 
                    value={newCustomer[PHONE_ID] || ""} 
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className={phoneError ? "border-red-500" : ""}
                  />
                  {phoneError && <p className="text-sm text-red-500">{phoneError}</p>}
                </div>
                
                {/* שורה: תשלום שוטף+ ואופן תשלום */}
                <div className="space-y-2">
                  <Label>תשלום שוטף+</Label>
                  <Input 
                    value={newCustomer[ONGOING_PAYMENT_ID] || ""} 
                    onChange={(e) => handleOngoingPaymentChange(e.target.value)}
                    className={ongoingPaymentError ? "border-red-500" : ""}
                  />
                  {ongoingPaymentError && <p className="text-sm text-red-500">{ongoingPaymentError}</p>}
                </div>
                <div className="space-y-2">
                  <Label>אופן תשלום</Label>
                  <Select value={newCustomer[PAYMENT_METHOD_ID]} onValueChange={(val) => setNewCustomer({...newCustomer, [PAYMENT_METHOD_ID]: val})}>
                    <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="מזומן">מזומן</SelectItem>
                      <SelectItem value="העברה בנקאית">העברה בנקאית</SelectItem>
                      <SelectItem value="צ'ק">צ'ק</SelectItem>
                      <SelectItem value="אפלקציה">אפלקציה</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* שורה: צ'קבוקס ומס' מפתח הנה"ח */}
                <div className="space-y-2 flex items-end">
                  <div className="flex items-center gap-2 p-3 border rounded-lg w-full h-10" style={{ backgroundColor: 'white' }}>
                    <Checkbox 
                      id="created-in-accounting" 
                      checked={newCustomer[CREATED_IN_ACCOUNTING_ID] || false}
                      onCheckedChange={(checked) => setNewCustomer({...newCustomer, [CREATED_IN_ACCOUNTING_ID]: checked})}
                    />
                    <Label htmlFor="created-in-accounting" className="cursor-pointer font-normal">נוצר בהנה"ח</Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>מס' מפתח הנה"ח</Label>
                  <Input 
                    value={newCustomer[ACCOUNTING_KEY_NUMBER_ID] || ""} 
                    onChange={(e) => handleAccountingKeyChange(e.target.value)}
                    className={accountingKeyError ? "border-red-500" : ""}
                  />
                  {accountingKeyError && <p className="text-sm text-red-500">{accountingKeyError}</p>}
                </div>
                
                {/* שורה אחרונה: אימייל */}
                <div className="space-y-2 col-span-2">
                  <Label>אימייל</Label>
                  <Input 
                    value={newCustomer[EMAIL_ID]} 
                    onChange={(e) => {setNewCustomer({...newCustomer, [EMAIL_ID]: e.target.value}); validateEmail(e.target.value)}} 
                    className={emailError ? "border-red-500" : ""} 
                  />
                  {emailError && <p className="text-sm text-red-500">{emailError}</p>}
                </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
                {isEditMode && (
                    <Button 
                        variant={(newCustomer[STATUS_FIELD_ID] || "פעיל") === "לא פעיל" ? "default" : "destructive"} 
                        onClick={handleDeleteCustomer} 
                        className={`mr-auto ${(newCustomer[STATUS_FIELD_ID] || "פעיל") === "לא פעיל" ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-rose-400 hover:bg-rose-500 text-white"}`}
                    >
                        {(newCustomer[STATUS_FIELD_ID] || "פעיל") === "לא פעיל" ? "הפוך לפעיל" : "הפוך ללא פעיל"}
                    </Button>
                )}
                <Button 
                  onClick={isEditMode ? handleUpdateCustomer : handleCreateCustomer} 
                  disabled={(!isEditMode && !newCustomer[NAME_ID]) || !!emailError || !!phoneError || !!accountingKeyError || !!ongoingPaymentError}
                >
                  {isEditMode ? "שמור שינויים" : "צור לקוח"}
                </Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
