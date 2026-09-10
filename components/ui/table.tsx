import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function TableWrap({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("overflow-x-auto", className)} {...props} />;
}
function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-[13px]", className)} {...props} />;
}
function Thead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("border-b border-border text-left text-[11.5px] uppercase tracking-wide text-text-muted", className)} {...props} />;
}
function Th({ className, ...props }: ComponentProps<"th">) {
  return <th className={cn("px-3 py-2 font-semibold", className)} {...props} />;
}
function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("border-b border-border last:border-0 hover:bg-bg", className)} {...props} />;
}
function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-3 py-2.5 text-text", className)} {...props} />;
}

export { TableWrap, Table, Thead, Th, Tr, Td };
