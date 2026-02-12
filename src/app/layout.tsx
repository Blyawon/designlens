import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import ThemeToggle from "@/components/ThemeToggle";
import ScrollToTop from "@/components/ScrollToTop";
import AmbientParticles from "@/components/AmbientParticles";
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
        {/* Ambient background particles — stars at night, dust motes by day.
            Wrapped in a delayed fade so the particle layer materialises
            alongside the gradient orbs rather than popping in instantly. */}
        <div style={{ animation: "fadeIn 2s ease-out 0.3s both" }}>
          <AmbientParticles />
        </div>
        {/* Theme toggle — fixed top-right, fades up with the page entrance.
            Uses fadeUp (not fadeIn) for motion consistency with the content. */}
        <div
          className="fixed top-4 right-4 sm:top-5 sm:right-6 z-50"
          style={{ animation: "fadeUp 0.5s ease-out 0.8s both" }}
        >
          <ThemeToggle />
        </div>
        {children}
        {/* Scroll-to-top — fixed bottom-right, with progress ring */}
        <ScrollToTop />
      </body>
    </html>
  );
}
