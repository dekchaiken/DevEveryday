// ไอคอนแบบ flat ของธีมคริสต์มาส วาดด้วย SVG ล้วน ไม่ใช้ emoji
type Name = "bauble" | "crown" | "snow" | "tree" | "snowman" | "users" | "gift" | "sparkle" | "heart" | "star" | "check" | "close" | "copy" | "share" | "cross";

export function Icon({ name, size = 20, className }: { name: Name; size?: number; className?: string }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true, className: `xicon ${className ?? ""}` };
  switch (name) {
    case "tree":
      return (
        <svg {...common}>
          <path d="M12 2.5 17.5 10h-2.8L19 15.5H5L8.3 10H5.5z" fill="#22c55e" />
          <rect x="10.8" y="15.5" width="2.4" height="3.5" rx="0.6" fill="#8b5a2b" />
          <path d="M12 1.2l.8 1.6 1.7.2-1.3 1.1.4 1.7L12 4.9l-1.6.9.4-1.7-1.3-1.1 1.7-.2z" fill="#f5c542" />
        </svg>
      );
    case "bauble":
      return (
        <svg {...common} fill="none" strokeLinecap="round">
          <path d="M12 2.2v2.4" stroke="#dbeafe" strokeWidth="1.5" />
          <rect x="10.3" y="4" width="3.4" height="2.2" rx="0.8" fill="#e2e8f0" />
          <circle cx="12" cy="14" r="7.4" fill="#7dd3fc" />
          <circle cx="12" cy="14" r="7.4" stroke="#e0f2fe" strokeWidth="0.6" />
          <path d="M8.4 11.4a4.2 4.2 0 0 1 2.8-2.9" stroke="#ffffff" strokeWidth="1.3" opacity="0.85" />
          <path d="M9 17.4a5 5 0 0 0 3.6 1.3" stroke="#0369a1" strokeWidth="1" opacity="0.35" />
          <path d="M14.8 12.6v2.8M13.4 14h2.8" stroke="#ffffff" strokeWidth="0.9" opacity="0.7" />
        </svg>
      );
    case "crown":
      return (
        <svg {...common} strokeLinejoin="round">
          <path d="M3.2 8.6 7.6 12.6 12 5.6l4.4 7 4.4-4-2 10.4H5.2z" fill="#fde68a" stroke="#f59e0b" strokeWidth="1" />
          <circle cx="12" cy="4.6" r="1.4" fill="#e0f2fe" />
          <circle cx="3.2" cy="8.4" r="1.1" fill="#e0f2fe" />
          <circle cx="20.8" cy="8.4" r="1.1" fill="#e0f2fe" />
          <rect x="5.4" y="16.6" width="13.2" height="2.2" rx="0.8" fill="#f59e0b" />
        </svg>
      );
    case "snow":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 2v20M3.5 7l17 10M3.5 17l17-10" />
          <path d="M9.5 3.8 12 6l2.5-2.2M9.5 20.2 12 18l2.5 2.2" />
        </svg>
      );
    case "snowman":
      return (
        <svg {...common}>
          <circle cx="12" cy="17" r="5.2" fill="#ffffff" stroke="#c9d6e2" strokeWidth="0.6" />
          <circle cx="12" cy="11" r="3.9" fill="#ffffff" stroke="#c9d6e2" strokeWidth="0.6" />
          <rect x="7.6" y="7.4" width="8.8" height="2.2" rx="1" fill="#f5c542" />
          <path d="M8.6 7.4 Q8.6 2.4 12 2.4 Q15.4 2.4 15.4 7.4 Z" fill="#dc2643" />
          <circle cx="12" cy="2.2" r="1.3" fill="#ffffff" />
          <circle cx="10.5" cy="10.4" r="0.7" fill="#111" />
          <circle cx="13.5" cy="10.4" r="0.7" fill="#111" />
          <path d="M12 11.2 15 11.9 12 12.6 Z" fill="#ff8a1f" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.2" fill="#7ee7b0" />
          <path d="M3 19.5c.6-3.4 3-5.3 6-5.3s5.4 1.9 6 5.3z" fill="#7ee7b0" />
          <circle cx="16.5" cy="8.5" r="2.7" fill="#f5c542" />
          <path d="M14.5 19.5c.4-2.6 2-4.2 4.2-4.2 1.4 0 2.6.7 3.3 1.9l-.5 2.3z" fill="#f5c542" />
        </svg>
      );
    case "gift":
      return (
        <svg {...common}>
          <rect x="3.5" y="9" width="17" height="11" rx="1.5" fill="#dc2643" />
          <rect x="2.5" y="6.5" width="19" height="3.5" rx="1" fill="#e8415f" />
          <rect x="10.8" y="6.5" width="2.4" height="13.5" fill="#f5c542" />
          <path d="M12 6.5c-1.6-3.2-4.8-3.4-4.8-1.2 0 1.2 2.4 1.2 4.8 1.2zm0 0c1.6-3.2 4.8-3.4 4.8-1.2 0 1.2-2.4 1.2-4.8 1.2z" fill="#f5c542" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...common}>
          <path d="M12 2.5c.7 4.6 2.9 6.8 7.5 7.5-4.6.7-6.8 2.9-7.5 7.5-.7-4.6-2.9-6.8-7.5-7.5 4.6-.7 6.8-2.9 7.5-7.5z" fill="#f5c542" />
          <path d="M19 15.5c.3 1.9 1.2 2.8 3 3-1.8.3-2.7 1.2-3 3-.3-1.8-1.2-2.7-3-3 1.8-.2 2.7-1.1 3-3z" fill="#ffe08a" />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <path d="M12 2.8l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.1l-5.6 2.9 1.1-6.2-4.5-4.4 6.2-.9z" fill="#f5c542" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path d="M12 20.5 4.6 13.2a4.6 4.6 0 0 1 6.5-6.5L12 7.6l.9-.9a4.6 4.6 0 0 1 6.5 6.5z" fill="currentColor" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "close":
    case "cross":
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );
    case "copy":
      return (
        <svg {...common}>
          <rect x="8" y="8" width="12" height="12" rx="2.5" fill="currentColor" opacity="0.35" />
          <rect x="4" y="4" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "share":
      return (
        <svg {...common}>
          <circle cx="18" cy="5.5" r="2.6" fill="currentColor" />
          <circle cx="6" cy="12" r="2.6" fill="currentColor" />
          <circle cx="18" cy="18.5" r="2.6" fill="currentColor" />
          <path d="M8.3 10.8l7.4-4M8.3 13.2l7.4 4" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
  }
}
