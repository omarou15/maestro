import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[var(--maestro-cream)] flex items-center justify-center">
      <SignUp afterSignUpUrl="/dashboard" />
    </div>
  )
}
