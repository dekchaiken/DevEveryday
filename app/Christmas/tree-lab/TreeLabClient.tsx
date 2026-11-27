"use client";

import dynamic from "next/dynamic";

// Three.js ทำงานเฉพาะฝั่งเบราว์เซอร์
const TreeLab = dynamic(() => import("@/components/christmas/TreeLab"), { ssr: false });

export default function TreeLabClient() {
  return <TreeLab />;
}
