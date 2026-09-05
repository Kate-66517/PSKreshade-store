import "./globals.css";

export const metadata = {
  title: "ReShade Store — Premium FiveM Presets",
  description: "Cinematic, premium ReShade presets for FiveM.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
