
"use client"

import { useState } from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"

interface DataGridProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  setData: (data: TData[]) => void
  fetchData: () => void
}

export function DataGrid<TData extends { id: string }, TValue>({
  columns,
  data,
  setData,
  fetchData,
}: DataGridProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = useState({})

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleDeleteSelected = async () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows
    if (selectedRows.length === 0) return

    const ids = selectedRows.map((row) => row.original.id)

    // Optimistic UI update
    const remainingData = data.filter(
      (record) => !ids.includes(record.id)
    )
    setData(remainingData)
    setRowSelection({})

    try {
      await fetch("/api/work-schedule/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })

      toast({
        title: `${ids.length} רשומות נמחקו בהצלחה`,
      })
    } catch (error) {
      console.error(error)

      toast({
        title: "שגיאה במחיקה",
        description: "הרשומות ישוחזרו",
        variant: "destructive",
      })

      // Rollback if failed
      fetchData()
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between py-4">
        <Button
          variant="destructive"
          onClick={handleDeleteSelected}
        >
          מחק נבחרים
        </Button>
      </div>

      <div className="rounded-md border">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="p-2 text-right">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="p-2">
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
