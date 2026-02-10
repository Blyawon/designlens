import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Designlens — Audit any website's visual consistency",
  description:
    "Paste a URL and get an instant design-system health report: colour sprawl, typography sprawl, spacing consistency, and more.",
};

/* Inline script that runs before paint to set the theme class.
   This prevents a flash of light mode when the user has dark mode saved. */
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased min-h-screen`}
      >
        {/* Theme toggle — fixed top-right */}
        <div className="fixed top-4 right-4 sm:top-5 sm:right-6 z-50">
          <ThemeToggle />
        </div>
        {children}
      </body>
    </html>
  );
}
