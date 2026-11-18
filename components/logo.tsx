export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  // A plate with a fork-and-pin: "food, here".
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="var(--brand)" />
      <circle cx="16" cy="16" r="10" fill="none" stroke="#fff" strokeWidth="2" opacity="0.9" />
      <path d="M16 8.5c-3 0-5.2 2.3-5.2 5.1 0 3.7 5.2 9.9 5.2 9.9s5.2-6.2 5.2-9.9c0-2.8-2.2-5.1-5.2-5.1Z" fill="#fff" />
      <circle cx="16" cy="13.6" r="2" fill="var(--brand)" />
    </svg>
  );
}
