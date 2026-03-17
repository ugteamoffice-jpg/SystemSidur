"use client"
import { SignOutButton } from "@clerk/nextjs"

export function SignOutBtn() {
  return (
    <SignOutButton redirectUrl="/sign-in">
      <button className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700">
        התנתק והתחבר עם משתמש אחר
      </button>
    </SignOutButton>
  )
}
