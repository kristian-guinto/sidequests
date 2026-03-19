import type { Metadata } from "next"
import { StrategyMap } from "@/components/strategy-map"

export const metadata: Metadata = {
  title: "Strategy Map · NEM Battery Dashboard",
  description: "3D visualisation of battery trading strategies",
}

export default function StrategyPage() {
  return <StrategyMap />
}
