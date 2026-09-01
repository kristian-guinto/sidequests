import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

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
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-white dark:bg-[#000000] text-neutral-900 dark:text-neutral-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-white transition-colors duration-150">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
