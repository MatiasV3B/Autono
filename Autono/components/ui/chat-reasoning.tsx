import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { UIDataTypes, UIMessagePart, UITools } from "ai";
import React from "react";

export default function ChatReasoning({
  partsInAccordion,
  defaultValue,
  renderMessagePart,
  className,
}: {
  partsInAccordion: UIMessagePart<UIDataTypes, UITools>[];
  defaultValue?: string;
  renderMessagePart?: (
    part: UIMessagePart<UIDataTypes, UITools>,
    index: number
  ) => React.ReactNode;
  className?: string;
}) {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultValue}
      className={cn("w-full", className)}
    >
      <AccordionItem value="item-1">
        <AccordionTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
            <span>Reasoning</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="text-sm text-muted-foreground pt-2">
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-2 top-2 bottom-2 w-[2px] bg-muted" />
            {partsInAccordion.map((part, index) => {
              if (renderMessagePart) {
                return (
                  <div key={index} className="relative">
                    <div className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full border border-background bg-muted-foreground" />
                    {renderMessagePart(part, index)}
                  </div>
                );
              }
              return (
                <div key={index} className="relative">
                  <div className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full border border-background bg-muted-foreground" />
                  <div className="text-foreground font-medium">
                    {part.type}
                  </div>
                  <pre className="text-xs overflow-x-auto p-2 bg-muted rounded-md mt-1">
                    {JSON.stringify(part, null, 2)}
                  </pre>
                </div>
              );
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
