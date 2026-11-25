import type { Metadata, Viewport } from "next";
import ChristmasExperience from "@/components/christmas/ChristmasExperience";

export const metadata: Metadata = {
  title: "ต้นคริสต์มาสร่วมกัน · DevEveryday",
  description: "แขวนลูกบอลและคำอวยพรบนต้นคริสต์มาสร่วมกับทุกคนแบบเรียลไทม์",
};

export const viewport: Viewport = {
  themeColor: "#06141c",
};

export default function ChristmasPage() {
  return <ChristmasExperience />;
}
