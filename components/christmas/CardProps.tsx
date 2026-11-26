"use client";

import type { PropKind } from "@/lib/christmas/cardSpec";

// ของตกแต่งการ์ดแบบ flat วาดด้วย SVG ล้วน (ไม่ใช้ emoji และไม่ต้องโหลดไฟล์ภายนอก)
export function PropArt({ kind }: { kind: PropKind }) {
  const common = { viewBox: "0 0 40 40", className: "xc-prop-svg", "aria-hidden": true } as const;
  switch (kind) {
    case "bell":
      return (
        <svg {...common}>
          <path d="M20 6c-5 0-8.5 4-8.5 10.5V24l-3 4.5h23L28.5 24v-7.5C28.5 10 25 6 20 6z" fill="#f5c542" />
          <path d="M20 4v2" stroke="#b9862a" strokeWidth="2" strokeLinecap="round" />
          <circle cx="20" cy="33" r="2.8" fill="#b9862a" />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <polygon points="20,4 24.5,15 36,15.5 27,22.5 30,34 20,27.5 10,34 13,22.5 4,15.5 15.5,15" fill="#ffd76a" stroke="#b9862a" strokeWidth="1" strokeLinejoin="round" />
        </svg>
      );
    case "candy":
      return (
        <svg {...common}>
          <path d="M14 36V18a6 6 0 0 1 12 0" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
          <path d="M14 36V18a6 6 0 0 1 12 0" fill="none" stroke="#dc2643" strokeWidth="6" strokeLinecap="round" strokeDasharray="4 4" />
        </svg>
      );
    case "gift":
      return (
        <svg {...common}>
          <rect x="7" y="16" width="26" height="19" rx="2" fill="#dc2643" />
          <rect x="18" y="16" width="4" height="19" fill="#f5c542" />
          <rect x="7" y="22" width="26" height="4" fill="#f5c542" />
          <path d="M20 16c-4-7-10-6-8-2s5 2 8 2zM20 16c4-7 10-6 8-2s-5 2-8 2z" fill="#f5c542" />
        </svg>
      );
    case "snowman":
      return (
        <svg {...common}>
          <circle cx="20" cy="27" r="9" fill="#ffffff" stroke="#c9d6e2" strokeWidth="1" />
          <circle cx="20" cy="13" r="6.5" fill="#ffffff" stroke="#c9d6e2" strokeWidth="1" />
          <rect x="13" y="6" width="14" height="4" rx="1" fill="#1f2937" />
          <rect x="16" y="1.5" width="8" height="5" rx="1" fill="#1f2937" />
          <path d="M20 13l5 1.5-5 1.2z" fill="#ff8a1f" />
          <circle cx="18" cy="12" r="1" fill="#111" />
          <circle cx="22" cy="12" r="1" fill="#111" />
        </svg>
      );
    case "holly":
      return (
        <svg {...common}>
          <path d="M6 24c4-10 10-12 14-8 4-4 10-2 14 8-6 0-9-3-14-1-5-2-8 1-14 1z" fill="#16a34a" />
          <circle cx="16" cy="26" r="3.2" fill="#dc2643" />
          <circle cx="24" cy="26" r="3.2" fill="#dc2643" />
        </svg>
      );
    case "bow":
      return (
        <svg {...common}>
          <path d="M20 20L6 12v16z" fill="#dc2643" />
          <path d="M20 20l14-8v16z" fill="#dc2643" />
          <circle cx="20" cy="20" r="3.2" fill="#7d0d24" />
        </svg>
      );
    case "tree":
      return (
        <svg {...common}>
          <path d="M20 4L30 18H25L33 28H7L15 18H10z" fill="#22a95a" />
          <rect x="17.5" y="28" width="5" height="7" rx="1" fill="#8b5a2b" />
          <circle cx="20" cy="3.5" r="2" fill="#f5c542" />
        </svg>
      );
    case "bauble":
      return (
        <svg {...common}>
          <rect x="16" y="2.5" width="8" height="4" rx="1" fill="#b9862a" />
          <circle cx="20" cy="22" r="14" fill="#dc2643" />
          <circle cx="15" cy="16" r="3.5" fill="#ffffff" opacity="0.55" />
        </svg>
      );
    case "snowflake":
      return (
        <svg {...common}>
          <g stroke="#38bdf8" strokeWidth="2.6" strokeLinecap="round">
            <path d="M20 4v32M6.5 12l27 16M6.5 28l27-16" />
          </g>
          <circle cx="20" cy="20" r="3" fill="#ffffff" />
        </svg>
      );
  }
}
