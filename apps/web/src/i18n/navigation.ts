import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

// Locale-aware replacements for next/link and next/navigation. Always import from
// here rather than from next/link, or locale prefixes get dropped.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
