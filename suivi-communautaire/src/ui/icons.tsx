import type { Child } from "hono/jsx";
import { cn } from "./cn";
// Tracés Lucide (https://lucide.dev), intégrés pour éviter un runtime React.
const paths = {
  "arrow-left": <><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>,
  "arrow-up": <><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></>,
  "arrow-down": <><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>,
  "arrow-right-left": <><path d="m16 3 4 4-4 4" /><path d="M20 7H4" /><path d="m8 21-4-4 4-4" /><path d="M4 17h16" /></>,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  "circle-alert": <><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></>,
  "circle-check": <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>,
  "clipboard-list": <><rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" /></>,
  "file-text": <><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></>,
  folder: <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />,
  info: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
  "log-out": <><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /></>,
  plus: <><path d="M5 12h14" /><path d="M12 5v14" /></>,
  search: <><path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" /></>,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
} satisfies Record<string, Child>;
export type IconName = keyof typeof paths;
export function Icon({ name, class: className }: { name: IconName; class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={cn("size-4 shrink-0", className)}
    >
      {paths[name]}
    </svg>
  );
}
