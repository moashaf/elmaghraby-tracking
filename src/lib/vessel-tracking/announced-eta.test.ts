import { describe, expect, it } from "vitest";
import { daysBetweenIsoDates } from "@/lib/eta";
import { parseAnnouncedEtaToIsoDate, resolveArrivalEtaFromVoyage } from "@/lib/vessel-tracking/announced-eta";
import { parseMyShipTrackingHtml } from "@/lib/vessel-tracking/myshiptracking";
import { parseVesselFinderLocationHtml, parseVesselFinderPortCalls } from "@/lib/vessel-tracking/vesselfinder";

describe("parseAnnouncedEtaToIsoDate", () => {
  it("parses AIS dates without a year using the current year when still upcoming", () => {
    const now = new Date("2026-10-03T12:00:00");
    expect(parseAnnouncedEtaToIsoDate("Oct 13, 17:00", now)).toBe("2026-10-13");
  });

  it("rolls yearless dates into next year when they are well in the past", () => {
    const now = new Date("2026-10-03T12:00:00");
    expect(parseAnnouncedEtaToIsoDate("Jan 05, 08:00", now)).toBe("2027-01-05");
  });

  it("parses ISO dates", () => {
    expect(parseAnnouncedEtaToIsoDate("2026-10-04 12:00 (UTC)")).toBe("2026-10-04");
  });
});

describe("daysBetweenIsoDates", () => {
  it("counts calendar days between ship date and announced arrival", () => {
    expect(daysBetweenIsoDates("2026-09-20", "2026-10-13")).toBe(23);
  });
});

describe("parseVesselFinderLocationHtml", () => {
  it("reads announced destination and arrival from the AIS summary", () => {
    const html = `
      The vessel TIGER LONGKOU (IMO 9913547) is currently located in Red Sea reported 8 min ago by AIS.
      The vessel is en route to the port of <strong>Aden, Yemen</strong>, sailing at a speed of 13.9 knots
      and expected to arrive there on <strong>Oct 13, 17:00</strong>.
    `;
    const now = new Date("2026-10-03T12:00:00");
    const parsed = parseVesselFinderLocationHtml(html, now);
    expect(parsed?.destination).toBe("Aden, Yemen");
    expect(parsed?.etaIso).toBe("2026-10-13");
    expect(parsed?.area).toBe("Red Sea");
  });
});

describe("parseMyShipTrackingHtml", () => {
  it("reads ETA next to the ETA label", () => {
    const html =
      "lat=12.3&lng=45.6" +
      '<th>Area</th><td>Red Sea</td>' +
      '<small>ETA</small></div> <div class=""><span class="line">2026-10-04</span> <span class="line"><b>12:00 (UTC)</b></span></div>';
    const parsed = parseMyShipTrackingHtml(html);
    expect(parsed?.etaIso).toBe("2026-10-04");
    expect(parsed?.lat).toBe(12.3);
  });
});

describe("resolveArrivalEtaFromVoyage", () => {
  it("uses the Sokhna port call instead of the next-voyage China ETA", () => {
    const eta = resolveArrivalEtaFromVoyage({
      arrivalPort: "السخنة، مصر",
      destination: "Qingdao, China",
      currentEtaIso: "2026-10-22",
      portCalls: [{ port: "Sokhna, Egypt", kind: "ATD", dateIso: "2026-10-01" }],
    });
    expect(eta).toBe("2026-10-01");
  });

  it("falls back to an Egypt port call when Sokhna is not listed", () => {
    const eta = resolveArrivalEtaFromVoyage({
      arrivalPort: "السخنة، مصر",
      destination: "Shanghai, China",
      currentEtaIso: "2026-10-13",
      portCalls: [{ port: "As Suways (Suez) Anch., Egypt", kind: "ATD", dateIso: "2026-09-25" }],
    });
    expect(eta).toBe("2026-09-25");
  });
});

describe("parseVesselFinderPortCalls", () => {
  it("reads last-port ATD dates", () => {
    const html =
      '<a class="_npNa" href="/ports/EGSOK001">Sokhna, Egypt</a> <div class="_value">ATD: Oct 1, 16:25 UTC</div>';
    const now = new Date("2026-10-03T12:00:00");
    expect(parseVesselFinderPortCalls(html, now)).toEqual([
      { port: "Sokhna, Egypt", kind: "ATD", dateIso: "2026-10-01" },
    ]);
  });
});
