"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PurchaseOrderForm } from "@/components/purchase-order-form";
import { PageHeader } from "@/components/ui";
import { useLanguage } from "@/context/language-context";

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const { tr } = useLanguage();

  return (
    <div className="space-y-5">
      <PageHeader
        title={tr("أمر شراء جديد", "New purchase order", "新建采购单")}
        description={tr(
          "إنشاء أمر شراء مسودة وإرساله للمورد للتأكيد.",
          "Create a draft PO for supplier confirmation.",
          "创建采购订单草稿并发送给供应商确认。"
        )}
        actions={
          <Link className="btn btn-secondary text-sm" href="/purchase-orders">
            <ArrowRight className="h-4 w-4" />
            {tr("رجوع", "Back", "返回")}
          </Link>
        }
      />
      <PurchaseOrderForm
        onCancel={() => router.push("/purchase-orders")}
        onSaved={(id) => router.push(`/purchase-orders/${id}`)}
      />
    </div>
  );
}
