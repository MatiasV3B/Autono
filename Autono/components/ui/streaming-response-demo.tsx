"use client";

import { StreamingResponse } from "@/components/ui/streaming-response";

const SOURCES = [
  {
    id: "motion-react",
    title: "Motion for React",
    domain: "motion.dev",
    url: "https://motion.dev/docs/react",
  },
  {
    id: "aria-busy",
    title: "ARIA live regions",
    domain: "developer.mozilla.org",
    url: "https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-busy",
  },
];

export default function StreamingResponseDemo() {
  return (
    <div className="mx-auto w-full max-w-xl p-6">
      <StreamingResponse
        status="complete"
        copyText="Paris is the capital of France. It has been the country's political and cultural center for centuries."
        onRetry={() => {}}
        sources={SOURCES}
      >
        <p>
          Paris is the capital of France. It has been the country's political
          and cultural center for centuries.
        </p>
      </StreamingResponse>
    </div>
  );
}
