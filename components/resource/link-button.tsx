import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/** A Next.js link styled as a button. */
export function LinkButton({
  href,
  variant = "outline",
  className,
  children,
  ...rest
}: { href: string; variant?: "default" | "outline" | "secondary" | "ghost" } & Omit<React.ComponentProps<typeof Link>, "href">) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant }), className)} {...rest}>
      {children}
    </Link>
  );
}
