import { cva, type VariantProps } from "class-variance-authority";
import type { JSX } from "hono/jsx";
import { cn } from "./cn";
import { Icon } from "./icons";
// Sources : shadcn/ui v4 « input », « textarea », « label », « native-select »
// et « field », sans React ni Radix. Bordure encre de 2 px selon l’identité.
const control =
  "w-full min-w-0 rounded-lg border-2 border-input bg-card px-3.5 text-base text-foreground transition-[color,box-shadow] outline-none placeholder:text-muted-foreground selection:bg-lavender selection:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20";
type Props<T extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[T];
export function Input({ class: className, type, ...props }: Props<"input">) {
  return <input type={type} data-slot="input" class={cn(control, "h-12", className as string)} {...props} />;
}
export function Textarea({ class: className, ...props }: Props<"textarea">) {
  return <textarea data-slot="textarea" class={cn(control, "flex min-h-28 py-3 leading-relaxed", className as string)} {...props} />;
}
export function Label({ class: className, ...props }: Props<"label">) {
  return (
    <label
      data-slot="label"
      class={cn("flex items-center gap-2 text-base leading-snug font-semibold select-none", className as string)}
      {...props}
    />
  );
}
export function NativeSelect({ class: className, ...props }: Props<"select">) {
  return (
    <div data-slot="native-select-wrapper" class="relative w-full has-[select:disabled]:opacity-50">
      <select data-slot="native-select" class={cn(control, "h-12 appearance-none pr-10", className as string)} {...props} />
      <Icon
        name="chevron-down"
        class="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-foreground"
      />
    </div>
  );
}
export function Checkbox({ class: className, ...props }: Omit<Props<"input">, "type">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      class={cn("size-5 shrink-0 cursor-pointer rounded-sm accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40", className as string)}
      {...props}
    />
  );
}
export function FieldSet({ class: className, ...props }: Props<"fieldset">) {
  return <fieldset data-slot="field-set" class={cn("flex min-w-0 flex-col gap-6", className as string)} {...props} />;
}
export function FieldLegend({ class: className, ...props }: Props<"legend">) {
  return <legend data-slot="field-legend" class={cn("mb-3 font-serif text-2xl tracking-tight", className as string)} {...props} />;
}
export function FieldGroup({ class: className, ...props }: Props<"div">) {
  return <div data-slot="field-group" class={cn("flex w-full flex-col gap-6", className as string)} {...props} />;
}
const fieldVariants = cva("group/field flex w-full gap-2 data-[invalid=true]:text-destructive", {
  variants: { orientation: { vertical: "flex-col", horizontal: "flex-row items-center gap-3" } },
  defaultVariants: { orientation: "vertical" },
});
export function Field({
  class: className,
  orientation = "vertical",
  ...props
}: Props<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      data-slot="field"
      data-orientation={orientation}
      class={cn(fieldVariants({ orientation }), className as string)}
      {...props}
    />
  );
}
export function FieldDescription({ class: className, ...props }: Props<"p">) {
  return <p data-slot="field-description" class={cn("text-sm leading-normal text-muted-foreground", className as string)} {...props} />;
}
export function FieldError({ class: className, ...props }: Props<"p">) {
  return <p role="alert" data-slot="field-error" class={cn("text-sm font-medium text-destructive", className as string)} {...props} />;
}
