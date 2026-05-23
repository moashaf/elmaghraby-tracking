import { ShipmentForm } from "@/components/shipment-form";
import { PageHeader } from "@/components/ui";

export default function NewShipmentPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="شحنة جديدة" description="بيانات أساسية فقط في المرحلة الأولى. الحاويات والمنتجات في المرحلة التالية." />
      <ShipmentForm />
    </div>
  );
}
