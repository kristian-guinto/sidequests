import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenElectricity PH (OpenNEM Philippines) | Live Grid & Market Tracker",
  description:
    "Live electricity generation, fuel mix, spot market prices (WESM/IEMOP), and emissions tracker for the Philippines grid (Luzon, Visayas, Mindanao).",
  keywords: ["OpenNEM", "OpenElectricity", "Philippines", "WESM", "IEMOP", "Solar", "Wind", "Hydro", "Geothermal", "Energy Tracker"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        {children}
      </body>
    </html>
  );
}
