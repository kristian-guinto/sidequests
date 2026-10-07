import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export const metadata: Metadata = {
  title: "OpenElectricity | Live Electricity Grid & Market Tracker",
  description:
    "OpenElectricity - live electricity grid, generation mix, emissions, and wholesale spot market tracker for Southeast Asia and beyond.",
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
