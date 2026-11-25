import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ChristmasExperience from "@/components/christmas/ChristmasExperience";
import RoomPicker from "@/components/christmas/RoomPicker";
import GiftIntro from "@/components/christmas/GiftIntro";
import { getRoom, ROOM_CAPACITY } from "@/lib/christmas/rooms";
import { roomCounts } from "@/lib/christmas/store";

export const metadata: Metadata = {
  title: "ต้นคริสต์มาสร่วมกัน · DevEveryday",
  description: "แขวนลูกบอลและคำอวยพรบนต้นคริสต์มาสร่วมกับทุกคนแบบเรียลไทม์",
  icons: { icon: "/christmas-icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#06141c",
};

export const dynamic = "force-dynamic";

// ?room=<id> เข้าห้องนั้นโดยตรง
// ไม่มี room: ถ้าเคยเข้าห้องไหนไว้ และห้องนั้นยังไม่เต็ม จะพาไปห้องเดิมอัตโนมัติ
// ?pick=1 หรือ ?full=<id> แสดงหน้าเลือกห้องเสมอ
export default async function ChristmasPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; full?: string; pick?: string }>;
}) {
  const { room, full, pick } = await searchParams;
  const valid = getRoom(room);

  if (!valid && !full && !pick) {
    const last = getRoom((await cookies()).get("xmas_room")?.value);
    if (last) {
      const counts = await roomCounts(Date.now());
      if ((counts[last.id] ?? 0) < ROOM_CAPACITY) redirect(`/Christmas?room=${last.id}`);
    }
  }

  // เปิดด้วยกล่องของขวัญทุกครั้งที่โหลดหน้า
  const content = valid ? (
    <ChristmasExperience key={valid.id} roomId={valid.id} />
  ) : (
    <RoomPicker fullRoom={getRoom(full)?.name ?? null} />
  );
  return <GiftIntro>{content}</GiftIntro>;
}
