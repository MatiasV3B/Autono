"use client";

import { Combobox } from "@base-ui/react/combobox";
import { PreviewCard } from "@base-ui/react/preview-card";
import {
  BrainIcon,
  CaretDownIcon,
  LightningIcon,
  MagnifyingGlassIcon,
  PaperPlaneTiltIcon,
} from "@phosphor-icons/react";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export type LlmModel = {
  value: string;
  label: string;
  provider: string;
  description: string;
  contextWindow: string;
  inputPrice: string;
  outputPrice: string;
  hasSpeedConfiguration?: boolean;
  metrics: {
    intelligence: number;
    speed: number;
    context: number;
    efficiency: number;
  };
};

export const DEFAULT_LLM_MODELS: LlmModel[] = [
  {
    value: "claude-fable-5",
    label: "Claude Fable 5",
    provider: "Anthropic",
    description:
      "Anthropic's newest frontier model with Opus fallback for difficult reasoning tasks.",
    contextWindow: "1M tokens",
    inputPrice: "$12.50 / 1M",
    outputPrice: "$50.00 / 1M",
    metrics: { intelligence: 10, speed: 5, context: 10, efficiency: 8 },
  },
  {
    value: "claude-opus-4.8",
    label: "Claude Opus 4.8",
    provider: "Anthropic",
    description:
      "Flagship Claude model for long-horizon coding, analysis, and agentic work.",
    contextWindow: "1M tokens",
    inputPrice: "$5.00 / 1M",
    outputPrice: "$25.00 / 1M",
    metrics: { intelligence: 10, speed: 4, context: 10, efficiency: 8 },
  },
  {
    value: "gpt-5.5-xhigh",
    label: "GPT-5.5",
    provider: "OpenAI",
    description:
      "OpenAI's strongest GPT-5.5 reasoning configuration for frontier coding and agentic workflows.",
    contextWindow: "920K tokens",
    inputPrice: "$5.00 / 1M",
    outputPrice: "$30.00 / 1M",
    hasSpeedConfiguration: true,
    metrics: { intelligence: 10, speed: 6, context: 9, efficiency: 9 },
  },
  {
    value: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro Preview",
    provider: "Gemini",
    description:
      "Google DeepMind's latest Gemini flagship with leading reasoning, coding, and multimodal input.",
    contextWindow: "2M tokens",
    inputPrice: "$2.00 / 1M",
    outputPrice: "$12.00 / 1M",
    metrics: { intelligence: 10, speed: 7, context: 10, efficiency: 10 },
  },
];

const DEFAULT_MODEL =
  DEFAULT_LLM_MODELS.find((model) => model.value === "claude-fable-5") ??
  DEFAULT_LLM_MODELS[0];

export type ReasoningLevel = "low" | "medium" | "high";
export type SpeedLevel = "standard" | "fast";

export type ModelConfiguration = {
  reasoning: ReasoningLevel;
  speed: SpeedLevel;
};

export type ModelSelectorSubmitPayload = {
  configuration: ModelConfiguration;
  configurations: Record<string, ModelConfiguration>;
  model: LlmModel;
  prompt: string;
};

export type ModelSelectorPromptProps = {
  className?: string;
  configurations?: Record<string, ModelConfiguration>;
  defaultConfigurations?: Record<string, ModelConfiguration>;
  defaultPrompt?: string;
  defaultValue?: string;
  disabled?: boolean;
  models?: readonly LlmModel[];
  onConfigurationChange?: (
    modelValue: string,
    configuration: ModelConfiguration,
    configurations: Record<string, ModelConfiguration>,
  ) => void;
  onModelChange?: (model: LlmModel) => void;
  onPromptChange?: (prompt: string) => void;
  onSubmit?: (payload: ModelSelectorSubmitPayload) => void | Promise<void>;
  placeholder?: string;
  prompt?: string;
  value?: string;
};

const DEFAULT_MODEL_CONFIGURATION: ModelConfiguration = {
  reasoning: "medium",
  speed: "standard",
};

function getModelConfiguration(
  configurations: Record<string, ModelConfiguration>,
  modelValue: string,
): ModelConfiguration {
  return configurations[modelValue] ?? DEFAULT_MODEL_CONFIGURATION;
}

const REASONING_INTELLIGENCE_DELTA: Record<ReasoningLevel, number> = {
  low: -2,
  medium: 0,
  high: 2,
};
const SPEED_METRIC_DELTA: Record<SpeedLevel, number> = {
  standard: 0,
  fast: 2,
};

function clampMetric(value: number) {
  return Math.min(10, Math.max(1, Math.round(value)));
}

// Inline provider marks (replacing the original PNG logos).
function ProviderIcon({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}) {
  const base = cn("size-3 shrink-0", className);
  if (provider === "Anthropic") {
    return (
      <svg className={base} viewBox="0 0 24 24" fill="#D97757" aria-hidden="true">
        <path d="M13.6 3h3.1l6.3 18h-3.2l-1.3-3.8h-6.6L10.7 21H7.5L13.6 3Zm-1.6 3.9-2.3 6.9h4.7L12 6.9Z" />
      </svg>
    );
  }
  if (provider === "OpenAI") {
    return (
      <svg className={base} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    );
  }
  if (provider === "Gemini") {
    return (
      <svg className={base} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 2c.4 4.7 3.3 8.4 8 9-4.7.6-7.6 4.3-8 9-.4-4.7-3.3-8.4-8-9 4.7-.6 7.6-4.3 8-9Z"
          fill="#3B82F6"
        />
      </svg>
    );
  }
  return null;
}

function ProviderLabel({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <ProviderIcon provider={provider} />
      <span className="truncate">{provider}</span>
    </span>
  );
}

const REASONING_LABELS: Record<ReasoningLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function ModelConfigurationBadge({
  model,
  configuration,
}: {
  model: LlmModel;
  configuration: ModelConfiguration;
}) {
  const showReasoning = configuration.reasoning !== "medium";
  const showFast =
    model.hasSpeedConfiguration && configuration.speed === "fast";
  if (!showReasoning && !showFast) {
    return null;
  }
  const badgeClassName =
    "inline-flex items-center gap-0.5 rounded-md bg-neutral-100 px-1 py-0.5 text-neutral-500 text-[10px] group-data-[selected]:bg-neutral-200";
  return (
    <div className="flex shrink-0 items-center gap-1">
      {showReasoning ? (
        <span className={badgeClassName}>
          <BrainIcon className="text-neutral-500" size={11} weight="fill" />
          {REASONING_LABELS[configuration.reasoning]}
        </span>
      ) : null}
      {showFast ? (
        <span className={badgeClassName}>
          <LightningIcon className="text-amber-500" size={11} weight="fill" />
          Fast
        </span>
      ) : null}
    </div>
  );
}

// Radix -9 scale colors, chosen by the metric's "score" (invert flips it, so a
// low cost reads as good/green and a high cost reads as bad/red).
function metricColor(value: number, invert: boolean) {
  const score = invert ? 11 - value : value;
  if (score >= 8) {
    return "#30a46c"; // green-9
  }
  if (score >= 6) {
    return "#46a758"; // grass-9
  }
  if (score >= 4) {
    return "#f76b15"; // orange-9
  }
  return "#e5484d"; // red-9
}

// A single segment that grows up from the bottom on mount (so newly-filled
// segments animate in when the value increases, and all animate on model swap).
function GrowSegment({ color, delay }: { color: string; delay: number }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div
      className="h-full w-full origin-bottom rounded-sm transition-transform duration-300 ease-out"
      style={{
        backgroundColor: color,
        transform: grown ? "scaleY(1)" : "scaleY(0)",
        transitionDelay: `${delay}ms`,
      }}
    />
  );
}

function MetricBar({
  label,
  value,
  info,
  invert = false,
  animationKey,
}: {
  label: string;
  value: number;
  info?: string;
  invert?: boolean;
  animationKey: string;
}) {
  const color = metricColor(value, invert);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono font-medium text-[10px] text-neutral-400 uppercase leading-none">
          {label}
        </span>
        {info ? (
          <span
            className="cursor-help text-[10px] text-neutral-400 leading-none"
            title={info}
          >
            &#9432;
          </span>
        ) : null}
      </div>
      <div
        aria-label={`${label}: ${value} out of 10`}
        className="grid grid-cols-10 gap-1"
        key={animationKey}
        role="img"
      >
        {Array.from({ length: 10 }, (_, index) => (
          <div
            className="h-3 overflow-hidden rounded-sm bg-neutral-100"
            key={index}
          >
            {index < value ? (
              <GrowSegment color={color} delay={index * 25} />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function SegmentedRadio<TValue extends string>({
  ariaLabel,
  onValueChange,
  options,
  value,
}: {
  ariaLabel: string;
  onValueChange: (value: TValue) => void;
  options: { label: string; value: TValue }[];
  value: TValue;
}) {
  return (
    <div aria-label={ariaLabel} className="flex gap-1" role="radiogroup">
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            aria-checked={checked}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-xs transition-colors",
              checked
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900",
            )}
            key={option.value}
            onClick={() => onValueChange(option.value)}
            role="radio"
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function Button({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function ModelPreviewPanel({
  model,
  configuration,
  onConfigurationChange,
}: {
  model: LlmModel;
  configuration: ModelConfiguration;
  onConfigurationChange: (update: Partial<ModelConfiguration>) => void;
}) {
  const { reasoning, speed } = configuration;
  const adjustedMetrics = useMemo(
    () => ({
      intelligence: clampMetric(
        model.metrics.intelligence + REASONING_INTELLIGENCE_DELTA[reasoning],
      ),
      speed: clampMetric(
        model.metrics.speed +
          (model.hasSpeedConfiguration ? SPEED_METRIC_DELTA[speed] : 0),
      ),
      context: model.metrics.context,
      efficiency: model.metrics.efficiency,
    }),
    [model.hasSpeedConfiguration, model.metrics, reasoning, speed],
  );
  return (
    <div className="flex w-56 flex-col divide-y divide-neutral-100">
      <div className="flex flex-col gap-3 p-3">
        <div className="flex flex-col gap-1">
          <p className="font-medium text-neutral-900 text-sm">{model.label}</p>
          <ProviderLabel
            className="text-neutral-500 text-xs"
            provider={model.provider}
          />
        </div>
        <p className="text-pretty text-neutral-500 text-xs leading-4">
          {model.description}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
          <MetricBar
            animationKey={model.value}
            label="Intelligence"
            value={adjustedMetrics.intelligence}
          />
          <MetricBar
            animationKey={model.value}
            label="Speed"
            value={adjustedMetrics.speed}
          />
          <MetricBar
            animationKey={model.value}
            info={`${model.contextWindow} context window`}
            label="Context"
            value={adjustedMetrics.context}
          />
          <MetricBar
            animationKey={model.value}
            info="Eficiencia computacional y de procesamiento"
            label="Efficiency"
            value={adjustedMetrics.efficiency}
          />
        </div>
      </div>
      <div className="flex flex-col gap-3 p-3">
        <p className="font-mono font-semibold text-[10px] text-neutral-500 uppercase leading-none">
          Configuration
        </p>
        <div className="flex flex-col gap-2">
          <p className="text-neutral-500 text-xs leading-none">Reasoning</p>
          <SegmentedRadio<ReasoningLevel>
            ariaLabel="Reasoning level"
            onValueChange={(reasoningValue) =>
              onConfigurationChange({ reasoning: reasoningValue })
            }
            options={[
              { label: "Low", value: "low" },
              { label: "Medium", value: "medium" },
              { label: "High", value: "high" },
            ]}
            value={reasoning}
          />
        </div>
        {model.hasSpeedConfiguration ? (
          <div className="flex flex-col gap-2">
            <p className="text-neutral-500 text-xs leading-none">Speed</p>
            <SegmentedRadio<SpeedLevel>
              ariaLabel="Speed"
              onValueChange={(speedValue) =>
                onConfigurationChange({ speed: speedValue })
              }
              options={[
                { label: "Standard", value: "standard" },
                { label: "Fast", value: "fast" },
              ]}
              value={speed}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ModelListWithScrollFade({ children }: { children: ReactNode }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [showBottomFade, setShowBottomFade] = useState(false);
  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    function updateBottomFade() {
      const el = listRef.current;
      if (!el) {
        return;
      }
      const { scrollTop, scrollHeight, clientHeight } = el;
      setShowBottomFade(scrollHeight - scrollTop - clientHeight > 4);
    }
    updateBottomFade();
    list.addEventListener("scroll", updateBottomFade, { passive: true });
    const resizeObserver = new ResizeObserver(updateBottomFade);
    resizeObserver.observe(list);
    return () => {
      list.removeEventListener("scroll", updateBottomFade);
      resizeObserver.disconnect();
    };
  }, []);
  return (
    <div className="relative">
      <Combobox.List
        className="max-h-64 overflow-y-auto overscroll-contain p-1"
        ref={listRef}
      >
        {children}
      </Combobox.List>
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-white to-transparent transition-opacity duration-150",
          showBottomFade ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

function ModelComboboxItem({
  model,
  configuration,
  previewHandle,
}: {
  model: LlmModel;
  configuration: ModelConfiguration;
  previewHandle: PreviewCard.Handle<LlmModel>;
}) {
  return (
    <Combobox.Item
      className="group w-full p-0 text-neutral-700 data-[selected]:text-neutral-900"
      value={model}
    >
      <PreviewCard.Trigger
        className="flex w-full items-start gap-2 rounded-md px-1.5 py-1.5 hover:bg-neutral-100 group-data-[selected]:bg-neutral-100"
        closeDelay={180}
        delay={80}
        handle={previewHandle}
        payload={model}
        render={<div />}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate">{model.label}</span>
          <ProviderLabel
            className="text-neutral-500 text-xs"
            provider={model.provider}
          />
        </div>
        <ModelConfigurationBadge configuration={configuration} model={model} />
      </PreviewCard.Trigger>
    </Combobox.Item>
  );
}

export function ModelSelectorPrompt({
  className,
  configurations,
  defaultConfigurations = {},
  defaultPrompt = "",
  defaultValue,
  disabled = false,
  models = DEFAULT_LLM_MODELS,
  onConfigurationChange,
  onModelChange,
  onPromptChange,
  onSubmit,
  placeholder = "What do you want to do?",
  prompt,
  value,
}: ModelSelectorPromptProps = {}) {
  const fallbackModel = models[0] ?? DEFAULT_MODEL;
  const [uncontrolledModelValue, setUncontrolledModelValue] = useState(
    defaultValue ?? fallbackModel.value,
  );
  const [uncontrolledConfigurations, setUncontrolledConfigurations] = useState<
    Record<string, ModelConfiguration>
  >(defaultConfigurations);
  const [uncontrolledPrompt, setUncontrolledPrompt] = useState(defaultPrompt);
  const selectedModelValue = value ?? uncontrolledModelValue;
  const selectedModel =
    models.find((model) => model.value === selectedModelValue) ?? fallbackModel;
  const modelConfigurations = configurations ?? uncontrolledConfigurations;
  const promptValue = prompt ?? uncontrolledPrompt;
  const previewHandle = useMemo(() => PreviewCard.createHandle<LlmModel>(), []);

  function updateModelConfiguration(
    modelValue: string,
    update: Partial<ModelConfiguration>,
  ) {
    const previous = modelConfigurations;
    const nextConfiguration = {
      ...getModelConfiguration(previous, modelValue),
      ...update,
    };
    const nextConfigurations = {
      ...previous,
      [modelValue]: nextConfiguration,
    };
    if (!configurations) {
      setUncontrolledConfigurations(nextConfigurations);
    }
    onConfigurationChange?.(modelValue, nextConfiguration, nextConfigurations);
  }
  function updateSelectedModel(model: LlmModel) {
    if (!value) {
      setUncontrolledModelValue(model.value);
    }
    onModelChange?.(model);
  }
  function updatePrompt(nextPrompt: string) {
    if (prompt === undefined) {
      setUncontrolledPrompt(nextPrompt);
    }
    onPromptChange?.(nextPrompt);
  }
  async function handleSubmit() {
    await onSubmit?.({
      configuration: getModelConfiguration(
        modelConfigurations,
        selectedModel.value,
      ),
      configurations: modelConfigurations,
      model: selectedModel,
      prompt: promptValue,
    });
  }
  function closeModelPreview() {
    previewHandle.close();
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-md flex-col rounded-xl border border-neutral-200 bg-white",
        className,
      )}
    >
      <textarea
        className="min-h-16 w-full resize-none bg-transparent p-3 font-medium text-neutral-900 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onChange={(event) => updatePrompt(event.target.value)}
        placeholder={placeholder}
        value={promptValue}
      />
      <div className="flex w-full flex-row items-center justify-between gap-2 p-2">
        <Combobox.Root<LlmModel>
          autoHighlight
          isItemEqualToValue={(item, nextValue) =>
            item.value === nextValue.value
          }
          items={models}
          onInputValueChange={closeModelPreview}
          onValueChange={(nextModel) => {
            if (nextModel) {
              updateSelectedModel(nextModel);
            }
          }}
          value={selectedModel}
        >
          <Combobox.Trigger
            aria-label="Select model"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-neutral-900 text-sm transition-colors hover:bg-neutral-50 data-[popup-open]:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
          >
            <Combobox.Value>
              {(model: LlmModel | null) =>
                model ? (
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <ProviderIcon
                        className="size-3.5"
                        provider={model.provider}
                      />
                      <span className="truncate">{model.label}</span>
                    </span>
                    <ModelConfigurationBadge
                      configuration={getModelConfiguration(
                        modelConfigurations,
                        model.value,
                      )}
                      model={model}
                    />
                  </span>
                ) : (
                  <span>Select model</span>
                )
              }
            </Combobox.Value>
            <Combobox.Icon className="text-neutral-500">
              <CaretDownIcon size={14} weight="bold" />
            </Combobox.Icon>
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner align="start" sideOffset={4}>
              <Combobox.Popup
                aria-label="Select model"
                className="w-60 rounded-xl border border-neutral-200 bg-white shadow-lg outline-none"
              >
                <PreviewCard.Root<LlmModel> handle={previewHandle}>
                  {({ payload }) => (
                    <>
                      <Combobox.InputGroup className="flex items-center gap-1.5 rounded-none border-0 border-b border-neutral-100 bg-transparent px-2">
                        <Combobox.Input
                          className="w-full bg-transparent px-0 py-2 text-sm outline-none placeholder:text-neutral-400"
                          onFocus={closeModelPreview}
                          placeholder="Search models..."
                        />
                        <MagnifyingGlassIcon
                          aria-hidden="true"
                          className="shrink-0 text-neutral-400"
                          size={14}
                          weight="bold"
                        />
                      </Combobox.InputGroup>
                      <Combobox.Empty>
                        <div className="flex flex-col gap-1 px-2 py-2 text-center font-medium text-neutral-500 text-xs">
                          No models found
                          <div className="text-pretty text-center text-neutral-400 text-xs">
                            Maybe try a different search.
                          </div>
                        </div>
                      </Combobox.Empty>
                      <ModelListWithScrollFade>
                        {(model: LlmModel) => (
                          <ModelComboboxItem
                            configuration={getModelConfiguration(
                              modelConfigurations,
                              model.value,
                            )}
                            key={model.value}
                            model={model}
                            previewHandle={previewHandle}
                          />
                        )}
                      </ModelListWithScrollFade>
                      <PreviewCard.Portal keepMounted>
                        <PreviewCard.Positioner
                          align="center"
                          className="z-[60]"
                          side="right"
                          sideOffset={8}
                        >
                          <PreviewCard.Popup className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg outline-none">
                            {payload ? (
                              <ModelPreviewPanel
                                configuration={getModelConfiguration(
                                  modelConfigurations,
                                  payload.value,
                                )}
                                model={payload}
                                onConfigurationChange={(update) =>
                                  updateModelConfiguration(payload.value, update)
                                }
                              />
                            ) : null}
                          </PreviewCard.Popup>
                        </PreviewCard.Positioner>
                      </PreviewCard.Portal>
                    </>
                  )}
                </PreviewCard.Root>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
        <Button
          disabled={disabled}
          onClick={() => void handleSubmit()}
          type="button"
        >
          <PaperPlaneTiltIcon size={14} weight="fill" />
          Send
        </Button>
      </div>
    </div>
  );
}

export default ModelSelectorPrompt;
