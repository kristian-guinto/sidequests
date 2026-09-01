import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenElectricity Southeast Asia | Live Grid & Market Tracker",
  description:
    "Open-source electricity market and fuel mix tracker for Southeast Asia (Philippines, Singapore, Malaysia, Thailand, Vietnam), inspired by OpenNEM.",
  keywords: [
    "OpenNEM",
    "OpenElectricity",
    "Philippines",
    "Singapore",
    "Malaysia",
    "WESM",
    "IEMOP",
    "NEMS",
    "Solar",
    "Wind",
    "Hydro",
    "Geothermal",
    "Energy Tracker",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-white">
      <body className="min-h-screen bg-white text-slate-900 flex flex-col antialiased selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
