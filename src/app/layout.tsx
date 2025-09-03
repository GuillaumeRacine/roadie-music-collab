import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roadie - Music Collaboration Hub",
  description: "Organize, share, and collaborate on your music ideas and lyrics with your band through Dropbox integration.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}