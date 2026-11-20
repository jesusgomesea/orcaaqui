"use client";

import type { ComponentProps } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("mb-4 inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-surface-2 p-1 [scrollbar-width:none]", className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-text-muted transition-colors cursor-pointer hover:text-text",
        // aba ativa: realce de vidro com anel na cor da empresa (app/vidro.css)
        "data-[state=active]:vidro-realce data-[state=active]:text-text",
        className
      )}
      {...props}
    />
  );
}

const TabsContent = TabsPrimitive.Content;

export { Tabs, TabsList, TabsTrigger, TabsContent };
