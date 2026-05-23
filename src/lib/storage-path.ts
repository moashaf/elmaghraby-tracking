/** Supabase Storage keys must be ASCII-safe (no Arabic/spaces in paths). */

export function safeStorageFileName(originalName: string): string {
  const trimmed = originalName.trim() || "file";
  const dot = trimmed.lastIndexOf(".");
  const ext = dot > 0 ? trimmed.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
  const base = trimmed
    .slice(0, dot > 0 ? dot : trimmed.length)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  const safeBase = base || "file";
  return `${Date.now()}-${safeBase}${ext || ""}`;
}

export function shipmentDocumentPath(shipmentId: string, prefix: string, fileName: string) {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "") || "doc";
  return `${shipmentId}/documents/${safePrefix}-${safeStorageFileName(fileName)}`;
}

export function shipmentInvPath(shipmentId: string, fileName: string) {
  return shipmentDocumentPath(shipmentId, "inv", fileName);
}

export function shipmentContainerFilePath(shipmentId: string, containerId: string, fileName: string) {
  return `${shipmentId}/containers/${containerId}/${safeStorageFileName(fileName)}`;
}
