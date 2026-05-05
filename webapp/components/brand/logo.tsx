import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  withText?: boolean;
};

export function BrandLogo({ className, withText = true }: Props) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative h-full aspect-square">
        <Image
          src="/logo.png"
          alt="WIN Empresas"
          fill
          sizes="48px"
          className="object-contain"
          priority
        />
      </div>
      {withText ? (
        <div className="flex flex-col leading-tight">
          <span className="font-semibold text-sm tracking-tight">
            Segmentador
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            WIN Empresas
          </span>
        </div>
      ) : null}
    </div>
  );
}
