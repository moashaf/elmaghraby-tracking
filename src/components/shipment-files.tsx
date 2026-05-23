"use client";

import { useEffect, useState } from "react";
import { Download, FileUp, Upload } from "lucide-react";
import { ErrorMessage } from "@/components/ui";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { shipmentContainerFilePath, shipmentDocumentPath } from "@/lib/storage-path";
import type { ContainerFile, ShipmentContainer, ShipmentDocument } from "@/lib/types";

const bucket = "container-files";

export function ShipmentFiles({
  shipmentId,
  containers,
}: {
  shipmentId: string;
  containers: ShipmentContainer[];
}) {
  const [containerFiles, setContainerFiles] = useState<ContainerFile[]>([]);
  const [documents, setDocuments] = useState<ShipmentDocument[]>([]);
  const [containerId, setContainerId] = useState("");
  const [docType, setDocType] = useState("other");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const effectiveContainerId = containerId || containers[0]?.id || "";

  async function load() {
    setError("");
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError("اضبط ملف .env.local أولا بقيم Supabase.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const [filesResult, documentsResult] = await Promise.all([
      supabase
        .from("container_files")
        .select("*,shipment_containers(container_number)")
        .in("container_id", containers.map((container) => container.id).length ? containers.map((container) => container.id) : ["00000000-0000-0000-0000-000000000000"])
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("shipment_documents")
        .select("*")
        .eq("shipment_id", shipmentId)
        .order("uploaded_at", { ascending: false }),
    ]);
    setLoading(false);

    if (filesResult.error || documentsResult.error) {
      setError(filesResult.error?.message || documentsResult.error?.message || "تعذر تحميل الملفات.");
      return;
    }

    setContainerFiles((filesResult.data ?? []) as ContainerFile[]);
    setDocuments((documentsResult.data ?? []) as ShipmentDocument[]);
  }

  useEffect(() => {
    void Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId, containers.length]);

  async function uploadContainerFile(file: File | null) {
    if (!file || !effectiveContainerId) return;
    await uploadFile({
      file,
      path: shipmentContainerFilePath(shipmentId, effectiveContainerId, file.name),
      onSaved: async (storagePath) => {
        const user = await createClient().auth.getUser();
        return createClient().from("container_files").insert({
          container_id: effectiveContainerId,
          file_name: file.name,
          storage_path: storagePath,
          mime_type: file.type || null,
          size_bytes: file.size,
          uploaded_by: user.data.user?.id ?? null,
        });
      },
    });
  }

  async function uploadDocument(file: File | null) {
    if (!file) return;
    await uploadFile({
      file,
      path: shipmentDocumentPath(shipmentId, docType, file.name),
      onSaved: async (storagePath) => {
        const user = await createClient().auth.getUser();
        return createClient().from("shipment_documents").insert({
          shipment_id: shipmentId,
          doc_type: docType,
          file_name: file.name,
          storage_path: storagePath,
          mime_type: file.type || null,
          size_bytes: file.size,
          uploaded_by: user.data.user?.id ?? null,
        });
      },
    });
  }

  async function uploadFile({
    file,
    path,
    onSaved,
  }: {
    file: File;
    path: string;
    onSaved: (storagePath: string) => Promise<{ error: { message: string } | null }>;
  }) {
    setError("");
    setUploading(true);
    const uploadResult = await createClient().storage.from(bucket).upload(path, file, { upsert: false });

    if (uploadResult.error) {
      setUploading(false);
      setError(uploadResult.error.message);
      return;
    }

    const saveResult = await onSaved(uploadResult.data.path);
    setUploading(false);

    if (saveResult.error) {
      setError(saveResult.error.message);
      return;
    }

    await load();
  }

  async function download(path: string) {
    const result = await createClient().storage.from(bucket).createSignedUrl(path, 60);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-5">
      <ErrorMessage message={error} />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-4 p-4">
          <div className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-[#0f766e]" />
            <h2 className="font-bold">ملفات الحاويات Excel/CSV</h2>
          </div>
          <select className="input" value={effectiveContainerId} onChange={(event) => setContainerId(event.target.value)}>
            {containers.map((container) => (
              <option key={container.id} value={container.id}>
                {container.container_number}
              </option>
            ))}
          </select>
          <label className="btn w-fit cursor-pointer">
            <Upload className="h-4 w-4" />
            {uploading ? "جاري الرفع..." : "رفع ملف"}
            <input accept=".xlsx,.xls,.csv" className="hidden" disabled={uploading || !containerId} onChange={(event) => uploadContainerFile(event.target.files?.[0] ?? null)} type="file" />
          </label>
        </section>

        <section className="card space-y-4 p-4">
          <div className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-[#0f766e]" />
            <h2 className="font-bold">مستندات الشحنة</h2>
          </div>
          <select className="input" value={docType} onChange={(event) => setDocType(event.target.value)}>
            <option value="invoice">فاتورة</option>
            <option value="packing_list">Packing list</option>
            <option value="bill_of_lading">Bill of lading</option>
            <option value="other">أخرى</option>
          </select>
          <label className="btn w-fit cursor-pointer">
            <Upload className="h-4 w-4" />
            {uploading ? "جاري الرفع..." : "رفع مستند"}
            <input className="hidden" disabled={uploading} onChange={(event) => uploadDocument(event.target.files?.[0] ?? null)} type="file" />
          </label>
        </section>
      </div>

      <FilesTable
        loading={loading}
        rows={containerFiles.map((file) => ({
          id: file.id,
          label: file.file_name,
          context: file.shipment_containers?.container_number ?? "حاوية",
          date: file.uploaded_at,
          path: file.storage_path,
        }))}
        title="ملفات الحاويات"
        onDownload={download}
      />

      <FilesTable
        loading={loading}
        rows={documents.map((file) => ({
          id: file.id,
          label: file.file_name,
          context: file.doc_type,
          date: file.uploaded_at,
          path: file.storage_path,
        }))}
        title="مستندات الشحنة"
        onDownload={download}
      />
    </div>
  );
}

function FilesTable({
  title,
  rows,
  loading,
  onDownload,
}: {
  title: string;
  loading: boolean;
  rows: Array<{ id: string; label: string; context: string; date: string; path: string }>;
  onDownload: (path: string) => void;
}) {
  return (
    <section className="card overflow-auto">
      <div className="border-b border-[var(--border)] p-4 font-bold">{title}</div>
      <table className="min-w-full text-sm">
        <thead className="table-head">
          <tr>
            <th className="p-3 text-right">الملف</th>
            <th className="p-3 text-right">النوع/الحاوية</th>
            <th className="p-3 text-right">تاريخ الرفع</th>
            <th className="p-3 text-right">تحميل</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <tr><td className="p-4 text-[var(--muted)]" colSpan={4}>جاري التحميل...</td></tr> : rows.map((row) => (
            <tr className="border-t border-[var(--border)]" key={row.id}>
              <td className="p-3 font-semibold">{row.label}</td>
              <td className="p-3">{row.context}</td>
              <td className="p-3">{new Date(row.date).toISOString().slice(0, 10)}</td>
              <td className="p-3">
                <button className="btn btn-secondary px-2 py-1 text-xs" onClick={() => onDownload(row.path)} type="button">
                  <Download className="h-4 w-4" />
                  تحميل
                </button>
              </td>
            </tr>
          ))}
          {!loading && !rows.length ? <tr><td className="p-4 text-[var(--muted)]" colSpan={4}>لا توجد ملفات.</td></tr> : null}
        </tbody>
      </table>
    </section>
  );
}
