import type { routing } from "./routing";
import type messages from "../../messages/en.json";

// Type-checks locale values and message keys used with next-intl.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
