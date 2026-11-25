// รหัสเครื่องผู้ใช้ เก็บไว้ในเบราว์เซอร์ ใช้กันการกดถูกใจซ้ำและนับคนออนไลน์
export function getClientId(): string {
  try {
    let id = localStorage.getItem("xmas-client") ?? "";
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("xmas-client", id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
