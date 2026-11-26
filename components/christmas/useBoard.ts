"use client";

import { useCallback, useEffect, useState } from "react";

export type BoardWish = { id: string; name: string; wish: string; color: string; shape: string; createdAt: number; likes: number };
export type BoardSnow = { id: string; name: string; slot: number; createdAt: number; likes: number };
export type Board = { wishes: BoardWish[]; snowmen: BoardSnow[]; counts: Record<string, number> };

// อันดับถูกใจของห้อง โหลดเป็นระยะ และโหลดใหม่ได้ทันทีหลังกดถูกใจ
export function useBoard(roomId: string) {
  const [board, setBoard] = useState<Board>({ wishes: [], snowmen: [], counts: {} });
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/christmas/leaderboard?room=${roomId}`, { cache: "no-store" });
      if (res.ok) setBoard((await res.json()) as Board);
    } catch {
      /* ลองใหม่รอบถัดไป */
    }
  }, [roomId]);
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [refresh]);
  return { board, refresh };
}
