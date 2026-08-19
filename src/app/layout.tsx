import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import AuthProvider from "@/components/AuthProvider";
import DialogProvider from "@/components/DialogProvider";
import AppShell from "@/components/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Slowave1.0 Eng Ver. 관리자",
  description: "Slowave1.0 Eng Ver. 관리자 사이트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} h-full`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="h-full bg-bg-primary text-text-primary antialiased font-sans">
        <ThemeProvider>
          <DialogProvider>
            <AuthProvider>
              <AppShell>{children}</AppShell>
            </AuthProvider>
          </DialogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
