import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[var(--maestro-cream)] flex items-center justify-center">
      <SignIn afterSignInUrl="/dashboard" />
    </div>
  )
}
