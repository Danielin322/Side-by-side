import Link from "next/link";
import { mainNav } from "@/lib/routes";

export function SiteHeader() {
  return (
    <header>
      <nav aria-label="Main">
        <ul>
          {mainNav.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>{item.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
