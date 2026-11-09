import Link from "next/link";
import { routes } from "@/lib/routes";

export function SiteFooter() {
  return (
    <footer>
      <Link href={routes.terms}>Scope of support</Link>
    </footer>
  );
}
