import type { Metadata, Viewport } from "next";
import ChristmasExperience from "@/components/christmas/ChristmasExperience";
import RoomPicker from "@/components/christmas/RoomPicker";
import GiftIntro from "@/components/christmas/GiftIntro";
import { getRoom } from "@/lib/christmas/rooms";

export const metadata: Metadata = {
  title: "ต้นคริสต์มาสร่วมกัน · DevEveryday",
  description: "แขวนลูกบอลและคำอวยพรบนต้นคริสต์มาสร่วมกับทุกคนแบบเรียลไทม์",
};

export const viewport: Viewport = {
  themeColor: "#06141c",
};

// ?room=<id> เข้าห้องนั้นโดยตรง ไม่มีหรือไม่ถูกต้องให้แสดงหน้าเลือกห้อง
export default async function ChristmasPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; full?: string }>;
}) {
  const { room, full } = await searchParams;
  const valid = getRoom(room);
  // เปิดด้วยกล่องของขวัญก่อนเข้าหน้าเว็บ
  const content = valid ? (
    <ChristmasExperience key={valid.id} roomId={valid.id} />
  ) : (
    <RoomPicker fullRoom={getRoom(full)?.name ?? null} />
  );
  return <GiftIntro>{content}</GiftIntro>;
}
