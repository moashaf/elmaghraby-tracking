"use client";

import Link from "next/link";
import {
  canLinkVesselLocation,
  vesselLocationHref,
  type VesselLinkFields,
} from "@/lib/vessel-tracking/vessel-link";

export function VesselLocationLink({
  shipment,
  text,
  className = "",
  empty = "-",
}: {
  shipment: VesselLinkFields;
  text?: string | null;
  className?: string;
  empty?: string;
}) {
  const label =
    (text ?? shipment.vessel_location_text)?.trim() ||
    shipment.vessel_name?.trim() ||
    "";

  if (!label) return <span className={className}>{empty}</span>;

  const href = vesselLocationHref(shipment);
  if (!href || !canLinkVesselLocation(shipment)) {
    return (
      <span className={className} title={label}>
        {label}
      </span>
    );
  }

  const external = href.startsWith("http");
  const classes = `font-semibold text-[var(--primary)] underline-offset-2 hover:underline ${className}`;

  if (external) {
    return (
      <a
        className={classes}
        href={href}
        rel="noopener noreferrer"
        target="_blank"
        title={label}
      >
        {label}
      </a>
    );
  }

  return (
    <Link className={classes} href={href} title={label}>
      {label}
    </Link>
  );
}
