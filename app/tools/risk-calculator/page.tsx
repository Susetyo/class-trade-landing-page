import type { Metadata } from "next";
import { RiskCalculator } from "../../components/risk-calculator";

export const metadata: Metadata = {
  title: "Risk Calculator — Kafeinmatcha Academy",
  description:
    "Calculate your forex position risk per trade, daily risk limit, max entries per day, and how many losing trades it takes to blow your account.",
};

export default function RiskCalculatorPage() {
  return <RiskCalculator />;
}
