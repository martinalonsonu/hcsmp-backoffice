import type { Metadata } from "next";
import { Libre_Baskerville, Poppins } from "next/font/google";
import "./globals.css";
import { PortalProvider } from "@/components/portal/portal-provider";

const poppins = Poppins({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const libreBaskerville = Libre_Baskerville({
  variable: "--font-display-family",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Portal interno | HCSMP",
    template: "%s | HCSMP",
  },
  description:
    "Portal de gestión interna de la Hermandad de Cargadores de San Martín de Porres de Cruz Blanca.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${poppins.variable} ${libreBaskerville.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <PortalProvider>{children}</PortalProvider>
      </body>
    </html>
  );
}
