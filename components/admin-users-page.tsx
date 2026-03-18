"use client"

import React, { useState, useEffect } from "react"
import { useTenant } from "@/lib/tenant-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Users, UserPlus, Trash2, Loader2, Mail, Clock, Shield, ShieldCheck } from "lucide-react"

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

interface PendingInvite {
  id: string
  email: string
  role: string
  status: string
  createdAt: number
}

export function AdminUsersPage() {
  const { config, tenantId } = useTenant()
  const { toast } = useToast()
  const [members, setMembers] = useState<Member[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("org:member")
  const [isInviting, setIsInviting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "member" | "invite"; id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/users?tenant=${tenantId}`)
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setMembers(data.members || [])
      setPendingInvites(data.pendingInvites || [])
    } catch (error) {
      toast({ title: "שגיאה", description: "לא ניתן לטעון משתמשים", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (tenantId) fetchUsers() }, [tenantId])

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setIsInviting(true)
    try {
      const res = await fetch(`/api/admin/users?tenant=${tenantId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed")
      }
      toast({ title: "הצלחה", description: `הזמנה נשלחה ל-${inviteEmail}` })
      setShowInviteDialog(false)
      setInviteEmail("")
      fetchUsers()
    } catch (error: any) {
      toast({ title: "שגיאה", description: error.message || "שליחת ההזמנה נכשלה", variant: "destructive" })
    } finally {
      setIsInviting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setIsDeleting(true)
    try {
      const params = deleteConfirm.type === "member"
        ? `userId=${deleteConfirm.id}`
        : `invitationId=${deleteConfirm.id}`
      const res = await fetch(`/api/admin/users?tenant=${tenantId}&${params}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      toast({ title: "הצלחה", description: deleteConfirm.type === "member" ? "המשתמש הוסר" : "ההזמנה בוטלה" })
      setDeleteConfirm(null)
      fetchUsers()
    } catch {
      toast({ title: "שגיאה", description: "הפעולה נכשלה", variant: "destructive" })
    } finally {
      setIsDeleting(false)
    }
  }

  const getRoleLabel = (role: string) => {
    if (role === "org:admin") return "מנהל"
    return "משתמש"
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
        <Button size="sm" onClick={() => setShowInviteDialog(true)}>
          <UserPlus className="h-4 w-4 ml-2" />
          הזמן משתמש
        </Button>
      </div>

      {/* Active Members */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">משתמשים פעילים</h3>
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
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Mail className="h-3 w-3" />{m.email}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:block">{formatDate(m.createdAt)}</span>
                {m.role !== "org:admin" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteConfirm({ type: "member", id: m.id, name: m.firstName || m.email })}
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
      </div>

      {/* Pending Invitations */}
      {pendingInvites.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">הזמנות ממתינות</h3>
          <div className="border rounded-lg divide-y border-dashed">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <span className="text-sm">{inv.email}</span>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />ממתין לאישור · {formatDate(inv.createdAt)}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteConfirm({ type: "invite", id: inv.id, name: inv.email })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent dir="rtl" className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>הזמן משתמש חדש</DialogTitle>
            <DialogDescription>המשתמש יקבל הזמנה באימייל להצטרף למערכת</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>אימייל</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="mt-1"
                dir="ltr"
                disabled={isInviting}
              />
            </div>
            <div>
              <Label>תפקיד</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  size="sm"
                  variant={inviteRole === "org:member" ? "default" : "outline"}
                  onClick={() => setInviteRole("org:member")}
                  className="flex-1"
                >
                  <Shield className="h-3.5 w-3.5 ml-1" />משתמש
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={inviteRole === "org:admin" ? "default" : "outline"}
                  onClick={() => setInviteRole("org:admin")}
                  className="flex-1"
                >
                  <ShieldCheck className="h-3.5 w-3.5 ml-1" />מנהל
                </Button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowInviteDialog(false)} disabled={isInviting}>ביטול</Button>
            <Button onClick={handleInvite} disabled={isInviting || !inviteEmail.trim()}>
              {isInviting && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              שלח הזמנה
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent dir="rtl" className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>{deleteConfirm?.type === "member" ? "הסרת משתמש" : "ביטול הזמנה"}</DialogTitle>
            <DialogDescription>
              {deleteConfirm?.type === "member"
                ? `האם להסיר את ${deleteConfirm?.name} מהמערכת?`
                : `האם לבטל את ההזמנה ל-${deleteConfirm?.name}?`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={isDeleting}>ביטול</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              {deleteConfirm?.type === "member" ? "הסר" : "בטל הזמנה"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
