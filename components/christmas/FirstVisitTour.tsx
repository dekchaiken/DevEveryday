"use client";

// คำแนะนำครั้งแรกที่เข้าหน้าต้นคริสต์มาส แสดงครั้งเดียวต่อเบราว์เซอร์ (จำไว้ในเครื่อง)
import { useState } from "react";

const KEY = "xmas-tour-done-v1";
const STEPS = [
  { title: "แตะต้นคริสต์มาสเพื่อแขวนคำอวยพร", text: "แตะตรงไหนบนต้นก็ได้ ระบบจะเปิดหน้าแขวนคำอวยพรให้ทันทีที่จุดนั้น" },
  { title: "แตะบ้านหรือตุ๊กตาเพื่อดูรายละเอียด", text: "ขึ้นคำอธิบายข้างโมเดลก่อน กดปุ่มในคำอธิบายจึงจะเห็นป้าย ชื่อ และลิงก์ของเจ้าของ" },
  { title: "ลากเพื่อหมุนมุมมอง", text: "ลากพื้นที่ว่างเพื่อหมุนดูฉาก ใช้สองนิ้วหรือปุ่มซูมเพื่อเข้าใกล้" },
  { title: "ปุ่มด้านล่างคือเมนูหลัก", text: "คำอวยพร โซนคำอวยพร ตกแต่งตุ๊กตาหิมะ ชวนเพื่อน และ Exclusive ทั้งหมดอยู่ตรงนี้" },
];

function alreadyDone(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return true; // เบราว์เซอร์บล็อก storage ให้ข้ามไปเลย
  }
}

export function FirstVisitTour() {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(() => !alreadyDone());
  if (!open) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  function finish() {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* ไม่ทำให้หน้าพัง */
    }
    setOpen(false);
  }
  return (
    <div className="xmas-tour" role="dialog" aria-label="แนะนำการใช้งาน">
      <span className="xmas-tour-count">
        {step + 1} / {STEPS.length}
      </span>
      <b>{s.title}</b>
      <p>{s.text}</p>
      <div className="xmas-tour-actions">
        <button type="button" className="ghost" onClick={finish}>
          ข้าม
        </button>
        <button type="button" onClick={last ? finish : () => setStep(step + 1)}>
          {last ? "เริ่มเลย" : "ถัดไป"}
        </button>
      </div>
    </div>
  );
}
