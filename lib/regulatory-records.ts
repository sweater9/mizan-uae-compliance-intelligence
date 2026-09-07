import type { RegulatoryRecord } from "./regulatory-types";

// Production records are populated by the scheduled ingestion pipeline only after
// authoritative-source verification. Keeping this empty by default prevents
// sample or invented legal content from appearing as current law.
export const regulatoryRecords: RegulatoryRecord[] = [];

export const regulatorySourceRegistry = [
  { authority: "UAE Federal Legislation", jurisdiction: "UAE Federal", url: "https://uaelegislation.gov.ae/en" },
  { authority: "Dubai Legislation Portal", jurisdiction: "Dubai", url: "https://dlp.dubai.gov.ae/en/Pages/LegislationSearch.aspx" },
  { authority: "Dubai Financial Services Authority", jurisdiction: "DIFC", url: "https://www.dfsa.ae/" },
  { authority: "Abu Dhabi Global Market", jurisdiction: "ADGM", url: "https://www.adgm.com/" },
  { authority: "Federal Tax Authority", jurisdiction: "UAE Federal", url: "https://tax.gov.ae/" },
  { authority: "Central Bank of the UAE", jurisdiction: "UAE Federal", url: "https://www.centralbank.ae/" },
] as const;
