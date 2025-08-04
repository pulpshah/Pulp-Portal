import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme";
import AuthProvider from "@/components/auth/session-provider";

export const metadata: Metadata = {
  title: "Pulp Portal",
  description: "Pulp Portal", // TODO!: Add description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://use.typekit.net/jdi5bxn.css" />
      </head>
      <body className="antialiased font-primary" suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
