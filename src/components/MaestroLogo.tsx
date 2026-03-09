export default function MaestroLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#1A2F2A" />
      <circle cx="24" cy="24" r="6" fill="none" stroke="#D4940A" strokeWidth="2" />
      <circle cx="24" cy="24" r="11" fill="none" stroke="#D4940A" strokeWidth="1.2" opacity="0.6" />
      <circle cx="24" cy="24" r="16" fill="none" stroke="#D4940A" strokeWidth="0.8" opacity="0.3" />
      <path d="M24 18V10" stroke="#D4940A" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <path d="M29.2 21L35.5 14.5" stroke="#D4940A" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <path d="M18.8 21L12.5 14.5" stroke="#D4940A" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <path d="M29.2 27L35.5 33.5" stroke="#D4940A" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M18.8 27L12.5 33.5" stroke="#D4940A" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M24 30V38" stroke="#D4940A" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <circle cx="24" cy="10" r="2" fill="#D4940A" opacity="0.8" />
      <circle cx="35.5" cy="14.5" r="2" fill="#D4940A" opacity="0.7" />
      <circle cx="12.5" cy="14.5" r="2" fill="#D4940A" opacity="0.7" />
      <circle cx="35.5" cy="33.5" r="1.5" fill="#D4940A" opacity="0.4" />
      <circle cx="12.5" cy="33.5" r="1.5" fill="#D4940A" opacity="0.4" />
      <circle cx="24" cy="38" r="1.5" fill="#D4940A" opacity="0.4" />
    </svg>
  )
}
