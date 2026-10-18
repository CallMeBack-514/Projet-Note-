import { cva, type VariantProps } from "class-variance-authority";
import type { JSX } from "hono/jsx";
import { cn } from "./cn";
// Sources : shadcn/ui v4 « card », « badge », « alert », « empty », « separator »
// et « table ». Surfaces plates, bordure sable de 2 px, aucune ombre.
type Props<T extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[T];
export function Card({ class: className, ...props }: Props<"div">) {
  return (
    <div
      data-slot="card"
      class={cn("flex flex-col gap-6 rounded-2xl border-2 border-sand bg-card py-6 text-card-foreground", className as string)}
      {...props}
    />
  );
}
export function CardHeader({ class: className, ...props }: Props<"div">) {
  return <div data-slot="card-header" class={cn("grid auto-rows-min gap-1.5 px-6", className as string)} {...props} />;
}
export function CardTitle({ class: className, ...props }: Props<"h2">) {
  return <h2 data-slot="card-title" class={cn("font-serif text-3xl leading-none tracking-tight", className as string)} {...props} />;
}
export function CardDescription({ class: className, ...props }: Props<"p">) {
  return <p data-slot="card-description" class={cn("text-sm text-muted-foreground", className as string)} {...props} />;
}
export function CardContent({ class: className, ...props }: Props<"div">) {
  return <div data-slot="card-content" class={cn("px-6", className as string)} {...props} />;
}
export function CardFooter({ class: className, ...props }: Props<"div">) {
  return <div data-slot="card-footer" class={cn("flex flex-wrap items-center gap-3 px-6", className as string)} {...props} />;
}
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border-2 px-3 py-0.5 text-xs font-semibold whitespace-nowrap [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-foreground bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        success: "border-forest bg-forest text-cream",
        warning: "border-foreground bg-amber text-foreground",
        outline: "border-foreground text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);
export function Badge({
  class: className,
  variant = "default",
  ...props
}: Props<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" data-variant={variant} class={cn(badgeVariants({ variant }), className as string)} {...props} />;
}
const alertVariants = cva(
  "relative flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-sm leading-relaxed [&>svg]:mt-0.5 [&>svg]:size-5",
  {
    variants: {
      variant: {
        default: "border-foreground bg-lavender text-foreground",
        destructive: "border-destructive bg-card text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);
/** `role="status"` pour l’information, `role="alert"` pour l’erreur (contrat d’accessibilité). */
export function Alert({
  class: className,
  variant = "default",
  role,
  ...props
}: Props<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role={role ?? (variant === "destructive" ? "alert" : "status")}
      class={cn(alertVariants({ variant }), className as string)}
      {...props}
    />
  );
}
export function AlertTitle({ class: className, ...props }: Props<"div">) {
  return <div data-slot="alert-title" class={cn("font-semibold tracking-tight", className as string)} {...props} />;
}
export function AlertDescription({ class: className, ...props }: Props<"div">) {
  return <div data-slot="alert-description" class={cn("[&_p]:leading-relaxed", className as string)} {...props} />;
}
export function Empty({ class: className, ...props }: Props<"div">) {
  return (
    <div
      data-slot="empty"
      class={cn("flex min-w-0 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-sand p-8 text-center text-balance md:p-12", className as string)}
      {...props}
    />
  );
}
export function EmptyHeader({ class: className, ...props }: Props<"div">) {
  return <div data-slot="empty-header" class={cn("flex max-w-md flex-col items-center gap-2 text-center", className as string)} {...props} />;
}
export function EmptyTitle({ class: className, ...props }: Props<"h2">) {
  return <h2 data-slot="empty-title" class={cn("text-3xl tracking-tight", className as string)} {...props} />;
}
export function EmptyDescription({ class: className, ...props }: Props<"p">) {
  return <p data-slot="empty-description" class={cn("text-base text-muted-foreground", className as string)} {...props} />;
}
export function Separator({ class: className, ...props }: Props<"hr">) {
  return <hr data-slot="separator" class={cn("h-0.5 w-full shrink-0 border-0 bg-sand", className as string)} {...props} />;
}
export function Table({ class: className, ...props }: Props<"table">) {
  return (
    <div data-slot="table-container" class="relative w-full overflow-x-auto">
      <table data-slot="table" class={cn("w-full caption-bottom text-base", className as string)} {...props} />
    </div>
  );
}
export function TableHeader({ class: className, ...props }: Props<"thead">) {
  return <thead data-slot="table-header" class={cn("bg-secondary/60 [&_tr]:border-b-2", className as string)} {...props} />;
}
export function TableBody({ class: className, ...props }: Props<"tbody">) {
  return <tbody data-slot="table-body" class={cn("[&_tr:last-child]:border-0", className as string)} {...props} />;
}
export function TableRow({ class: className, ...props }: Props<"tr">) {
  return <tr data-slot="table-row" class={cn("border-b-2 border-sand transition-colors hover:bg-muted", className as string)} {...props} />;
}
export function TableHead({ class: className, ...props }: Props<"th">) {
  return <th data-slot="table-head" class={cn("h-11 px-4 text-left align-middle text-sm font-semibold text-foreground", className as string)} {...props} />;
}
export function TableCell({ class: className, ...props }: Props<"td">) {
  return <td data-slot="table-cell" class={cn("px-4 py-4 align-middle", className as string)} {...props} />;
}
