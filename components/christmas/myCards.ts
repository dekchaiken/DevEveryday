// การ์ดที่เครื่องนี้เป็นคนส่ง (เก็บไว้ในเครื่อง เพื่อแยกการ์ดของเราออกจากของคนอื่นในโซน)
const KEY = "xmas-my-cards";

export function myCardIds(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function rememberMyCard(id: string) {
  try {
    const ids = [...myCardIds(), id].slice(-300);
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* ไม่เป็นไร */
  }
}
