"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, Search, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const TABLE_ID = "tblRSYoKFHCaDyivO9k"
const VEHICLE_TYPE_FIELD_ID = "fldUBeIPRhJ9JuUHXBL"

interface Vehicle {
  id: string
  fields: {
    [VEHICLE_TYPE_FIELD_ID]?: string
    [key: string]: any
  }
}

export default function VehiclesGrid() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(600)
  const tableContainerRef = useRef<HTMLDivElement>(null)

  const ROW_HEIGHT = 53
  const BUFFER_SIZE = 5

  useEffect(() => {
    fetchVehicles()
  }, [])

  const fetchVehicles = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/vehicles`)
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()

      setVehicles(data.records || [])
    } catch (error) {
      console.error("Error fetching vehicles:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון סוגי רכבים",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateVehicle = async () => {
    try {
      const filteredFields = Object.entries(newVehicle).reduce((acc, [key, value]) => {
        if (value !== "" && value !== undefined && value !== null) {
          acc[key] = value
        }
        return acc
      }, {} as any)

      const response = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: filteredFields }),
      })

      if (!response.ok) {
        throw new Error("Failed to create")
      }

      toast({
        title: "הצלחה",
        description: "סוג רכב נוצר בהצלחה",
      })

      setIsDialogOpen(false)
      resetForm()
      fetchVehicles()
    } catch (error) {
      console.error("Error creating vehicle:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן ליצור סוג רכב",
        variant: "destructive",
      })
    }
  }

  const handleUpdateVehicle = async () => {
    if (!editingVehicleId) return

    try {
      const filteredFields = Object.entries(newVehicle).reduce((acc, [key, value]) => {
        if (value !== "" && value !== undefined && value !== null) {
          acc[key] = value
        }
        return acc
      }, {} as any)

      const response = await fetch(`/api/vehicles/${editingVehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: filteredFields }),
      })

      if (!response.ok) throw new Error("Failed to update")

      toast({
        title: "הצלחה",
        description: "סוג רכב עודכן בהצלחה",
      })

      setIsDialogOpen(false)
      setEditingVehicleId(null)
      resetForm()
      fetchVehicles()
    } catch (error) {
      console.error("Error updating vehicle:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן לעדכן סוג רכב",
        variant: "destructive",
      })
    }
  }

  const handleRowClick = (vehicle: Vehicle) => {
    setEditingVehicleId(vehicle.id)
    setNewVehicle({ ...vehicle.fields } as any)
    setIsDialogOpen(true)
  }

  const resetForm = () => {
    setNewVehicle({
      [VEHICLE_TYPE_FIELD_ID]: "",
    })
  }

  const [newVehicle, setNewVehicle] = useState({
    [VEHICLE_TYPE_FIELD_ID]: "",
  })

  const filteredVehicles = vehicles.filter((vehicle) => {
    if (!searchQuery) {
      return true
    }

    const searchLower = searchQuery.toLowerCase()
    const matchesSearch = Object.values(vehicle.fields).some((value) =>
      String(value).toLowerCase().includes(searchLower),
    )

    return matchesSearch
  })

  const isEditMode = !!editingVehicleId

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }

  useEffect(() => {
    if (tableContainerRef.current) {
      setContainerHeight(tableContainerRef.current.clientHeight)
    }
  }, [])

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_SIZE)
  const endIndex = Math.min(
    filteredVehicles.length,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + BUFFER_SIZE,
  )
  const visibleVehicles = filteredVehicles.slice(startIndex, endIndex)
  const totalHeight = filteredVehicles.length * ROW_HEIGHT
  const offsetY = startIndex * ROW_HEIGHT

  return (
    <div className="w-full p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 ml-2" />
          סוג רכב חדש
        </Button>

        <div className="relative w-[300px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="mr-auto text-sm text-muted-foreground whitespace-nowrap">
          סה"כ {filteredVehicles.length.toLocaleString("he-IL")} סוגי רכבים
        </div>
      </div>

      <div
        ref={tableContainerRef}
        className="border rounded-lg overflow-auto"
        style={{ height: "600px" }}
        onScroll={handleScroll}
      >
        <div style={{ height: `${totalHeight}px`, position: "relative" }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="text-right pr-4">סוג רכב</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={1} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-muted-foreground">טוען נתונים...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filteredVehicles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={1} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? "לא נמצאו תוצאות חיפוש" : "אין סוגי רכבים להצגה"}
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading &&
                  visibleVehicles.map((vehicle) => (
                    <TableRow
                      key={vehicle.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(vehicle)}
                      style={{ height: `${ROW_HEIGHT}px` }}
                    >
                      <TableCell className="text-right pr-4">{vehicle.fields[VEHICLE_TYPE_FIELD_ID] || "-"}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) {
            setEditingVehicleId(null)
            resetForm()
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "עריכת סוג רכב" : "סוג רכב חדש"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vehicleType">
                סוג רכב <span className="text-red-500">*</span>
              </Label>
              <Input
                id="vehicleType"
                value={newVehicle[VEHICLE_TYPE_FIELD_ID]}
                onChange={(e) => setNewVehicle({ ...newVehicle, [VEHICLE_TYPE_FIELD_ID]: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              onClick={isEditMode ? handleUpdateVehicle : handleCreateVehicle}
              disabled={!newVehicle[VEHICLE_TYPE_FIELD_ID] || newVehicle[VEHICLE_TYPE_FIELD_ID].trim() === ""}
            >
              {isEditMode ? "שמור שינויים" : "צור סוג רכב"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
