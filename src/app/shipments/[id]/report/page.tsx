import { ShipmentPrintReport } from "@/components/shipment-print-report";

export default async function ShipmentReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShipmentPrintReport shipmentId={id} />;
}
