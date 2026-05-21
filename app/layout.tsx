import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Family Budget",
  description: "Track your family income, expenses, and savings",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">
        {children}
      </body>
    </html>
  );
}
