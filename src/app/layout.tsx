// The real root layout (with <html>) lives in app/[locale]/layout.tsx,
// so each language can set its own lang and dir.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
