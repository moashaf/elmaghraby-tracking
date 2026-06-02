"use client";

import { ShipmentForm } from "@/components/shipment-form";
import { PageHeader } from "@/components/ui";
import { useLanguage } from "@/context/language-context";

export default function NewShipmentPage() {
  const { tr } = useLanguage();
  return (
    <div className="space-y-5">
      <PageHeader
        title={tr("شحنة جديدة", "New shipment")}
        description={tr(
          "بيانات أساسية فقط في المرحلة الأولى. الحاويات والمنتجات في المرحلة التالية.",
          "Basic data first. Containers and products come in the next step."
        )}
      />
      <ShipmentForm />
    </div>
  );
}
