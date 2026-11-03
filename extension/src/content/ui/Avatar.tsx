export function Avatar({ large }: { large?: boolean }) {
  const s = large ? 30 : 26;
  return (
    <span className={`avatar${large ? " lg" : ""}`} aria-hidden>
      <svg viewBox="0 0 32 32" width={s} height={s}>
        <path d="M16 4l3.4 7.6L27 13l-5.8 5.2L22.8 26 16 22l-6.8 4 1.6-7.8L5 13l7.6-1.4z" fill="#F4B740" />
        <circle cx="12.8" cy="15.6" r="1.4" fill="#13294B" /><circle cx="19.2" cy="15.6" r="1.4" fill="#13294B" />
        <path d="M13 19c1.8 1.4 4.2 1.4 6 0" stroke="#13294B" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}
