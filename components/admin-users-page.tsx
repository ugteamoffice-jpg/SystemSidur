"use client"

import React, { useState, useEffect } from "react"
import { useTenant } from "@/lib/tenant-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Users, UserPlus, Trash2, Loader2, Mail, Shield, ShieldCheck, Eye, EyeOff, Copy, Check } from "lucide-react"

interface Member {
  id: string
  membershipId: string
  firstName: string
  lastName: string
  email: string
  imageUrl: string
  role: string
  createdAt: number
}

export function AdminUsersPage() {
  const { config, tenantId } = useTenant()
  const { toast } = useToast()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newUser, setNewUser] = useState({ username: "", password: "", firstName: "", lastName: "" })
  const [newUserRole, setNewUserRole] = useState("org:member")
  const [isCreating, setIsCreating] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [createdInfo, setCreatedInfo] = useState<{ username: string; password: string } | null>(null)
  const [copiedField, setCopiedField] = useState("")

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/users?tenant=${tenantId}`)
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setMembers(data.members || [])
    } catch {
      toast({ title: "שגיאה", description: "לא ניתן לטעון משתמשים", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (tenantId) fetchUsers() }, [tenantId])

  const handleCreate = async () => {
    if (!newUser.username.trim() || !newUser.password.trim()) return
    setIsCreating(true)
    try {
      const res = await fetch(`/api/admin/users?tenant=${tenantId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newUser, role: newUserRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      
      // Show success with credentials
      setCreatedInfo({ username: newUser.username, password: newUser.password })
      toast({ title: "הצלחה", description: `המשתמש ${newUser.username} נוצר בהצלחה` })
      fetchUsers()
    } catch (error: any) {
      toast({ title: "שגיאה", description: error.message || "יצירת המשתמש נכשלה", variant: "destructive" })
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/users?tenant=${tenantId}&userId=${deleteConfirm.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      toast({ title: "הצלחה", description: "המשתמש הוסר" })
      setDeleteConfirm(null)
      fetchUsers()
    } catch {
      toast({ title: "שגיאה", description: "ההסרה נכשלה", variant: "destructive" })
    } finally {
      setIsDeleting(false)
    }
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(""), 2000)
  }

  const closeCreateDialog = () => {
    setShowCreateDialog(false)
    setNewUser({ username: "", password: "", firstName: "", lastName: "" })
    setNewUserRole("org:member")
    setShowPassword(false)
    setCreatedInfo(null)
  }

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h2 className="text-lg font-bold">ניהול משתמשים</h2>
          <span className="text-sm text-muted-foreground">({members.length})</span>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <UserPlus className="h-4 w-4 ml-2" />
          הוסף משתמש
        </Button>
      </div>

      {/* Active Members */}
      <div className="border rounded-lg divide-y">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              {m.imageUrl ? (
                <img src={m.imageUrl} alt="" className="h-9 w-9 rounded-full" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {(m.firstName?.[0] || m.email?.[0] || "?").toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {m.firstName || m.lastName ? `${m.firstName} ${m.lastName}`.trim() : m.email}
                  </span>
                  {m.role === "org:admin" ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded">
                      <ShieldCheck className="h-3 w-3" />מנהל
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                      <Shield className="h-3 w-3" />משתמש
                    </span>
                  )}
                </div>
                {m.email && (
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Mail className="h-3 w-3" />{m.email}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:block">{formatDate(m.createdAt)}</span>
              {m.role !== "org:admin" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteConfirm({ id: m.id, name: m.firstName || m.email })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
        {members.length === 0 && (
          <div className="p-6 text-center text-muted-foreground text-sm">אין משתמשים</div>
        )}
      </div>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={closeCreateDialog}>
        <DialogContent dir="rtl" className="sm:max-w-[420px]">
          {!createdInfo ? (
            <>
              <DialogHeader>
                <DialogTitle>הוסף משתמש חדש</DialogTitle>
                <DialogDescription>צור שם משתמש וסיסמה עבור המשתמש החדש</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">שם פרטי</Label>
                    <Input
                      value={newUser.firstName}
                      onChange={(e) => setNewUser(p => ({ ...p, firstName: e.target.value }))}
                      placeholder="ישראל"
                      className="mt-1 h-9 text-sm"
                      disabled={isCreating}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">שם משפחה</Label>
                    <Input
                      value={newUser.lastName}
                      onChange={(e) => setNewUser(p => ({ ...p, lastName: e.target.value }))}
                      placeholder="ישראלי"
                      className="mt-1 h-9 text-sm"
                      disabled={isCreating}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">שם משתמש <span className="text-destructive">*</span></Label>
                  <Input
                    value={newUser.username}
                    onChange={(e) => setNewUser(p => ({ ...p, username: e.target.value.replace(/\s/g, '') }))}
                    placeholder="israel123"
                    className="mt-1 h-9 text-sm"
                    dir="ltr"
                    disabled={isCreating}
                  />
                </div>
                <div>
                  <Label className="text-xs">סיסמה <span className="text-destructive">*</span></Label>
                  <div className="relative mt-1">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={newUser.password}
                      onChange={(e) => setNewUser(p => ({ ...p, password: e.target.value }))}
                      placeholder="לפחות 8 תווים"
                      className="h-9 text-sm pl-9"
                      dir="ltr"
                      disabled={isCreating}
                    />
                    <button
                      type="button"
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {newUser.password && newUser.password.length < 8 && (
                    <p className="text-xs text-destructive mt-1">סיסמה חייבת להכיל לפחות 8 תווים</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">תפקיד</Label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={newUserRole === "org:member" ? "default" : "outline"}
                      onClick={() => setNewUserRole("org:member")}
                      className="flex-1 h-8 text-xs"
                    >
                      <Shield className="h-3.5 w-3.5 ml-1" />משתמש
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={newUserRole === "org:admin" ? "default" : "outline"}
                      onClick={() => setNewUserRole("org:admin")}
                      className="flex-1 h-8 text-xs"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 ml-1" />מנהל
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeCreateDialog} disabled={isCreating}>ביטול</Button>
                <Button onClick={handleCreate} disabled={isCreating || !newUser.username.trim() || newUser.password.length < 8}>
                  {isCreating && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                  צור משתמש
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-green-600">המשתמש נוצר בהצלחה ✓</DialogTitle>
                <DialogDescription>שמור את הפרטים — הסיסמה לא תוצג שוב</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-3">
                <div className="bg-muted rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground block">שם משתמש</span>
                      <span className="font-mono font-medium" dir="ltr">{createdInfo.username}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => copyToClipboard(createdInfo.username, "username")}
                    >
                      {copiedField === "username" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground block">סיסמה</span>
                      <span className="font-mono font-medium" dir="ltr">{createdInfo.password}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => copyToClipboard(createdInfo.password, "password")}
                    >
                      {copiedField === "password" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full text-sm"
                  onClick={() => copyToClipboard(`שם משתמש: ${createdInfo.username}\nסיסמה: ${createdInfo.password}`, "both")}
                >
                  {copiedField === "both" ? <Check className="h-4 w-4 ml-2 text-green-500" /> : <Copy className="h-4 w-4 ml-2" />}
                  העתק הכל
                </Button>
              </div>
              <div className="flex justify-end">
                <Button onClick={closeCreateDialog}>סגור</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent dir="rtl" className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>הסרת משתמש</DialogTitle>
            <DialogDescription>האם להסיר את {deleteConfirm?.name} מהמערכת?</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={isDeleting}>ביטול</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              הסר
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
