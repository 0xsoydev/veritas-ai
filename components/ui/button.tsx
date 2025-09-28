import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-none focus-visible:ring-0 border-2 border-black font-bold tracking-wide",
  {
    variants: {
      variant: {
        default: "bg-main text-main-foreground hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
        destructive:
          "bg-red-500 text-white hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
        outline:
          "bg-background text-foreground border-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
        secondary:
          "bg-secondary-background text-foreground hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
        ghost:
          "bg-transparent text-foreground border-transparent hover:bg-main hover:text-main-foreground hover:border-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
        link: "text-main underline-offset-4 hover:underline bg-transparent border-transparent shadow-none hover:translate-x-0 hover:translate-y-0",
      },
      size: {
        default: "h-12 px-6 py-3 has-[>svg]:px-4 rounded-[5px]",
        sm: "h-10 px-4 py-2 has-[>svg]:px-3 rounded-[5px]",
        lg: "h-14 px-8 py-4 has-[>svg]:px-6 rounded-[5px] text-base",
        icon: "size-12 rounded-[5px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
