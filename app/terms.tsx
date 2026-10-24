// Terms & Conditions — text in lib/terms.json (same text as the website).
import React from "react";

import LegalScreen, { LegalDocument } from "../components/legal/LegalScreen";
import terms from "../lib/terms.json";

export default function TermsScreen() {
  return <LegalScreen title="Terms & Conditions" doc={terms as LegalDocument} />;
}
