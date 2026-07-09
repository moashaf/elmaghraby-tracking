"use client";

import { ShipmentForm } from "@/components/shipment-form";
import { PageHeader } from "@/components/ui";
import { useLanguage } from "@/context/language-context";

export default function NewShipmentPage() {
  const { tr } = useLanguage();
  return (
    <div className="space-y-5">
      <PageHeader
        title={tr("شحنة جديدة", "New shipment", "新建货运")}
        description={tr(
          "سجّل بيانات الشحنة والحاويات والمنتجات وارفع ملف INV (PDF) في نفس الصفحة.",
          "Enter shipment data, containers, products, and upload the INV PDF on one page.",
          "在同一页面录入货运信息、集装箱与产品，并上传 INV（PDF）。"
        )}
      />
      <ShipmentForm />
    </div>
  );
}
