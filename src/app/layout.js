import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AdminShortcut from "../components/AdminShortcut";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Next.js Project",
  description: "Project starting point.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><AdminShortcut />{children}</body>
    </html>
  );
}
