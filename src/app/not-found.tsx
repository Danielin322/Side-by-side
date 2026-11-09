import Link from "next/link";
import { routes } from "@/lib/routes";

export default function NotFound() {
  return (
    <>
      <h1>We couldn&apos;t find that page</h1>
      <Link href={routes.home}>Back to home</Link>
    </>
  );
}
