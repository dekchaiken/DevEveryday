import type { Content } from "@/lib/types";

// บันทึก content/site.json ลง GitHub ผ่าน Contents API
// การ commit จะทำให้ Vercel build และ deploy เวอร์ชันใหม่อัตโนมัติ
const API = "https://api.github.com";
const FILE_PATH = "content/site.json";

export async function saveContent(content: Content): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";
  if (!token || !repo) throw new Error("GITHUB_TOKEN / GITHUB_REPO ยังไม่ได้ตั้งค่า");

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
  const fileUrl = `${API}/repos/${repo}/contents/${FILE_PATH}`;

  const current = await fetch(`${fileUrl}?ref=${encodeURIComponent(branch)}`, {
    headers,
    cache: "no-store",
  });
  if (!current.ok) throw new Error(`อ่านไฟล์จาก GitHub ไม่สำเร็จ (${current.status})`);
  const { sha } = (await current.json()) as { sha: string };

  const text = JSON.stringify(content, null, 2) + "\n";
  const res = await fetch(fileUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: "content: update site from admin",
      content: Buffer.from(text, "utf8").toString("base64"),
      sha,
      branch,
    }),
  });
  if (!res.ok) throw new Error(`บันทึกไป GitHub ไม่สำเร็จ (${res.status})`);
}
