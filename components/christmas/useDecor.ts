"use client";

import { useCallback, useEffect, useState } from "react";
import type { Decor } from "@/lib/christmas/decor";

// ตุ๊กตาหิมะทั้งหมดของห้อง โหลดเป็นระยะ และโหลดใหม่ได้ทันทีหลังวางหรือถูกใจ
export function useDecor(roomId: string) {
  const [decor, setDecor] = useState<Decor[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/christmas/decor?room=${roomId}`, { cache: "no-store" });
      const data = (await res.json()) as { decor?: Decor[] };
      if (data.decor) setDecor(data.decor);
    } catch {
      /* ลองใหม่รอบถัดไป */
    }
  }, [roomId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 6000);
    return () => clearInterval(id);
  }, [refresh]);

  return { decor, refresh };
}
