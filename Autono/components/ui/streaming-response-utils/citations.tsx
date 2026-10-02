"use client";

import React from "react";
import { ExternalLink, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CitationItem {
  id?: string;
  title: string;
  domain?: string;
  url?: string;
  favicon?: string;
  snippet?: string;
}

export function CitationStack({
  citations,
  className,
}: {
  citations: CitationItem[];
  className?: string;
}) {
  const visible = citations.slice(0, 3);
  return (
    <div className={cn("inline-flex items-center -space-x-1.5", className)}>
      {visible.map((c, i) => (
        <span
          key={c.id || i}
          className="relative inline-flex size-4 items-center justify-center rounded-full border border-background bg-muted text-[9px] font-medium text-muted-foreground overflow-hidden"
          title={c.title}
        >
          {c.favicon ? (
            <img src={c.favicon} alt="" className="size-full object-cover" />
          ) : (
            <Globe className="size-2.5" />
          )}
        </span>
      ))}
    </div>
  );
}

export function CitationList({
  citations,
  idPrefix,
  className,
}: {
  citations: CitationItem[];
  idPrefix?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {citations.map((item, index) => {
        const itemId = item.id || `${idPrefix || "source"}-${index}`;
        const domain =
          item.domain ||
          (item.url ? new URL(item.url).hostname.replace(/^www\./, "") : "");

        return (
          <a
            key={itemId}
            id={itemId}
            href={item.url || "#"}
            target={item.url ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="group flex items-start gap-2.5 rounded-lg border border-border/50 bg-background/50 p-2 text-xs transition-colors hover:bg-background hover:border-border"
          >
            <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
              {item.favicon ? (
                <img src={item.favicon} alt="" className="size-3.5 object-contain" />
              ) : (
                <Globe className="size-3" />
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium text-foreground group-hover:text-primary">
                  {item.title}
                </span>
                {item.url ? (
                  <ExternalLink className="size-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                ) : null}
              </div>
              {domain ? (
                <span className="text-[10px] text-muted-foreground">{domain}</span>
              ) : null}
              {item.snippet ? (
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground/80">
                  {item.snippet}
                </p>
              ) : null}
            </div>
          </a>
        );
      })}
    </div>
  );
}
