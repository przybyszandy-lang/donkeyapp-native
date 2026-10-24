// Privacy Policy — text in lib/privacy.json (same text as the website).
import React from "react";

import LegalScreen, { LegalDocument } from "../components/legal/LegalScreen";
import privacy from "../lib/privacy.json";

export default function PrivacyScreen() {
  return <LegalScreen title="Privacy Policy" doc={privacy as LegalDocument} />;
}
