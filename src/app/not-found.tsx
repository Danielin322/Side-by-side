import Link from "next/link";

// Fallback for requests outside any locale (the middleware normally redirects these).
export default function GlobalNotFound() {
  return (
    <html lang="he" dir="rtl">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem", textAlign: "center" }}>
        <h1>לא מצאנו את העמוד הזה · We couldn&apos;t find that page</h1>
        <Link href="/">חזרה לדף הבית · Back to home</Link>
      </body>
    </html>
  );
}
