import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/cn";

type SliderProps = {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (value: number) => void;
  className?: string;
  "aria-label"?: string;
  disabled?: boolean;
};

export function Slider({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onValueChange,
  className,
  disabled,
  ...rest
}: SliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn("relative flex h-11 w-full touch-none items-center", className)}
      value={[value]}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next[0] ?? value)}
      {...rest}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow rounded-full bg-surface-2">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="relative block size-3.5 rounded-full bg-fg shadow-[var(--shadow-border)] outline-none after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 focus-visible:ring-2 focus-visible:ring-ring" />
    </SliderPrimitive.Root>
  );
}
