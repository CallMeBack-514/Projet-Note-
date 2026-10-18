import { cva, type VariantProps } from "class-variance-authority";
import type { JSX } from "hono/jsx";
import { cn } from "./cn";
// Source : shadcn/ui v4 « button », sans Radix Slot (voir LinkButton).
// Variantes recolorées pour l’identité : bordure encre de 2 px, aucune ombre.
export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-transparent text-base font-semibold whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-foreground bg-primary text-primary-foreground hover:bg-primary/70 active:translate-y-px",
        dark: "border-foreground bg-foreground text-background hover:bg-foreground/85 active:translate-y-px",
        outline: "border-foreground bg-card text-foreground hover:bg-secondary active:translate-y-px",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "text-foreground hover:bg-secondary",
        destructive: "border-destructive bg-destructive text-white hover:bg-destructive/90",
        link: "border-transparent px-0! text-foreground underline underline-offset-4 hover:decoration-2",
      },
      size: {
        default: "h-12 px-5 py-2 has-[>svg]:px-4",
        sm: "h-10 gap-1.5 rounded-lg px-4 text-sm has-[>svg]:px-3",
        lg: "h-14 rounded-xl px-6 text-lg has-[>svg]:px-5",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
type Style = VariantProps<typeof buttonVariants>;
export function Button({
  class: className,
  variant = "default",
  size = "default",
  ...props
}: JSX.IntrinsicElements["button"] & Style) {
  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      class={cn(buttonVariants({ variant, size }), className as string)}
      {...props}
    />
  );
}
/** Lien qui a l’apparence d’un bouton (équivalent de `<Button asChild>`). */
export function LinkButton({
  class: className,
  variant = "default",
  size = "default",
  ...props
}: JSX.IntrinsicElements["a"] & Style) {
  return (
    <a
      data-slot="button"
      data-variant={variant}
      data-size={size}
      class={cn(buttonVariants({ variant, size }), className as string)}
      {...props}
    />
  );
}
