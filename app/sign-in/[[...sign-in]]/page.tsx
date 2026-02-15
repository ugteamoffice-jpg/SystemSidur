import { SignIn } from "@clerk/nextjs"

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="text-center">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">מערכת ניהול</h1>
          <p className="text-gray-400">התחבר כדי להמשיך</p>
        </div>
        <SignIn 
          appearance={{
            elements: {
              rootBox: "mx-auto",
              cardBox: "shadow-2xl",
            }
          }}
        />
      </div>
    </div>
  )
}
