import type { Metadata } from "next";
import "./globals.css";
import "./tailwind.css";

export const metadata: Metadata = {
  title: "Pendataan Pengiriman Barang Kantor",
  description: "Sistem Pendataan Pengiriman Barang Kantor",
};

const THEME_INIT_SCRIPT = `
(function () {
  var STORAGE_KEY = "pengiriman-theme";
  var saved = localStorage.getItem(STORAGE_KEY);
  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute("data-theme", saved || (prefersDark ? "dark" : "light"));
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
