"use client";

import { useState } from "react";
import {
  DEFAULT_LLM_MODELS,
  ModelSelectorPrompt,
  type ModelConfiguration,
} from "@/components/ui/model-selector";

export default function Default() {
  const [modelValue, setModelValue] = useState("claude-fable-5");
  const [configurations, setConfigurations] = useState<
    Record<string, ModelConfiguration>
  >({});
  const [prompt, setPrompt] = useState("");

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-neutral-100 p-8">
      <ModelSelectorPrompt
        configurations={configurations}
        models={DEFAULT_LLM_MODELS}
        onConfigurationChange={(_, __, nextConfigurations) => {
          setConfigurations(nextConfigurations);
        }}
        onModelChange={(model) => {
          setModelValue(model.value);
        }}
        onPromptChange={setPrompt}
        onSubmit={({ model, configuration, prompt: submittedPrompt }) => {
          console.log({ model: model.value, configuration, prompt: submittedPrompt });
        }}
        prompt={prompt}
        value={modelValue}
      />
    </div>
  );
}
