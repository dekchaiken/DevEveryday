"use client";

import dynamic from "next/dynamic";

const SnowmanLab = dynamic(() => import("@/components/christmas/SnowmanLab"), { ssr: false });

export default function SnowmanLabClient() {
  return <SnowmanLab />;
}
