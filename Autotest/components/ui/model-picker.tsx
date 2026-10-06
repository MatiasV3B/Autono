"use client";

import { clsx, type ClassValue } from "clsx";
import {
  Brain,
  Check,
  ChevronDown,
  ImageIcon,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
  type SVGProps,
} from "react";
import { twMerge } from "tailwind-merge";
import AIContextMeter from "./ai-context-meter";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function Popover(props: ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger(props: ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 flex w-72 origin-[var(--radix-popover-content-transform-origin)] flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

function TooltipProvider({
  delayDuration = 0,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip(props: ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger(props: ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 0,
  hideArrow = false,
  children,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content> & {
  hideArrow?: boolean;
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 inline-flex w-fit max-w-xs origin-[var(--radix-tooltip-content-transform-origin)] items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        {!hideArrow && (
          <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" />
        )}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export type IconProps = SVGProps<SVGSVGElement>;

export function OpenAIIcon(props: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 260" fill="currentColor" {...props}>
      <path d="M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483Zm-97.56 136.338a48.397 48.397 0 0 1-31.105-11.255l1.535-.87 51.67-29.825a8.595 8.595 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601Zm-104.466-44.61a48.345 48.345 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.339 8.339 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803ZM23.549 85.38a48.499 48.499 0 0 1 25.58-21.333v61.39a8.288 8.288 0 0 0 4.195 7.316l62.874 36.272-21.845 12.636a.819.819 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405v.256Zm179.466 41.695-63.08-36.63L161.73 77.86a.819.819 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.544 8.544 0 0 0-4.4-7.213Zm21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.716.716 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391v.205ZM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87-51.67 29.825a8.595 8.595 0 0 0-4.246 7.367l-.051 72.697Zm11.868-25.58 28.138-16.217 28.188 16.218v32.434l-28.086 16.218-28.188-16.218-.052-32.434Z" />
    </svg>
  );
}

export function GeminiIcon(props: IconProps) {
  const rawId = useId();
  const id = useMemo(() => rawId.replace(/:/g, ""), [rawId]);
  return (
    <svg viewBox="0 0 296 298" xmlns="http://www.w3.org/2000/svg" fill="none" {...props}>
      <mask id={`${id}-mask`} width="296" height="298" x="0" y="0" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }}>
        <path fill="#3186FF" d="M141.201 4.886c2.282-6.17 11.042-6.071 13.184.148l5.985 17.37a184.004 184.004 0 0 0 111.257 113.049l19.304 6.997c6.143 2.227 6.156 10.91.02 13.155l-19.35 7.082a184.001 184.001 0 0 0-109.495 109.385l-7.573 20.629c-2.241 6.105-10.869 6.121-13.133.025l-7.908-21.296a184 184 0 0 0-109.02-108.658l-19.698-7.239c-6.102-2.243-6.118-10.867-.025-13.132l20.083-7.467A183.998 183.998 0 0 0 133.291 26.28l7.91-21.394Z" />
      </mask>
      <g mask={`url(#${id}-mask)`}>
        <g filter={`url(#${id}-b)`}><ellipse cx="163" cy="149" fill="#3689FF" rx="196" ry="159" /></g>
        <g filter={`url(#${id}-c)`}><ellipse cx="33.5" cy="142.5" fill="#F6C013" rx="68.5" ry="72.5" /></g>
        <g filter={`url(#${id}-d)`}><ellipse cx="19.5" cy="148.5" fill="#F6C013" rx="68.5" ry="72.5" /></g>
        <g filter={`url(#${id}-e)`}><path fill="#FA4340" d="M194 10.5C172 82.5 65.5 134.333 22.5 135L144-66l50 76.5Z" /></g>
        <g filter={`url(#${id}-f)`}><path fill="#FA4340" d="M190.5-12.5C168.5 59.5 62 111.333 19 112L140.5-89l50 76.5Z" /></g>
        <g filter={`url(#${id}-g)`}><path fill="#14BB69" d="M194.5 279.5C172.5 207.5 66 155.667 23 155l121.5 201 50-76.5Z" /></g>
        <g filter={`url(#${id}-h)`}><path fill="#14BB69" d="M196.5 320.5C174.5 248.5 68 196.667 25 196l121.5 201 50-76.5Z" /></g>
      </g>
      <defs>
        <filter id={`${id}-b`} width="464" height="390" x="-69" y="-46" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur result="effect1_foregroundBlur_69_17998" stdDeviation="18" /></filter>
        <filter id={`${id}-c`} width="265" height="273" x="-99" y="6" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur result="effect1_foregroundBlur_69_17998" stdDeviation="32" /></filter>
        <filter id={`${id}-d`} width="265" height="273" x="-113" y="12" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur result="effect1_foregroundBlur_69_17998" stdDeviation="32" /></filter>
        <filter id={`${id}-e`} width="299.5" height="329" x="-41.5" y="-130" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur result="effect1_foregroundBlur_69_17998" stdDeviation="32" /></filter>
        <filter id={`${id}-f`} width="299.5" height="329" x="-45" y="-153" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur result="effect1_foregroundBlur_69_17998" stdDeviation="32" /></filter>
        <filter id={`${id}-g`} width="299.5" height="329" x="-41" y="91" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur result="effect1_foregroundBlur_69_17998" stdDeviation="32" /></filter>
        <filter id={`${id}-h`} width="299.5" height="329" x="-39" y="132" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur result="effect1_foregroundBlur_69_17998" stdDeviation="32" /></filter>
      </defs>
    </svg>
  );
}

export type ModelCapability = "reasoning" | "image";

export type ThinkingEffort = "none" | "low" | "medium" | "high" | "max";

export type UsageLimitConfig = {
  type: "unlimited" | "window";
  limit?: number;
  windowHours?: number;
  label: string;
  badgeClass?: string;
  description?: string;
};

export type ModelPickerModel = {
  id: string;
  name: string;
  description?: string;
  available?: boolean;
  capabilities?: readonly ModelCapability[];
  thinking?: readonly ThinkingEffort[];
  defaultThinking?: ThinkingEffort;
  usageRating?: number;
  usageLimit?: UsageLimitConfig;
};

export type ModelPickerProvider = {
  id: string;
  name: string;
  icon?: ReactNode;
  models: ModelPickerModel[];
};

export type ModelPickerProps = {
  providers: readonly ModelPickerProvider[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (
    modelId: string,
    providerId: string,
    thinking?: ThinkingEffort,
  ) => void;
  thinking?: ThinkingEffort;
  defaultThinking?: ThinkingEffort;
  closeOnSelect?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  placeholder?: string;
  className?: string;
};

const CAPABILITY_LABEL: Record<ModelCapability, string> = {
  reasoning: "Reasoning",
  image: "Image",
};

const CAPABILITY_ICON: Record<ModelCapability, LucideIcon> = {
  reasoning: Brain,
  image: ImageIcon,
};

const CAPABILITY_ACCENT: Record<ModelCapability, string> = {
  reasoning: "text-violet-500 dark:text-violet-400",
  image: "text-teal-500 dark:text-teal-400",
};

const THINKING_LABEL: Record<ThinkingEffort, string> = {
  none: "Off",
  low: "Low",
  medium: "Medium",
  high: "High",
  max: "Max",
};

const FULL_THINKING = ["low", "medium", "high", "max"] as const;

const THIN_SCROLLBAR =
  "[scrollbar-color:var(--color-border,#d4d4d8)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--color-border,#d4d4d8)] [&::-webkit-scrollbar-track]:bg-transparent";

const HIDDEN_SCROLLBAR =
  "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function ClaudeIcon(props: IconProps) {
  return (
    <svg role="img" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

const FLASH_THINKING = ["low", "medium", "high"] as const;
const PRO_THINKING = ["low", "high"] as const;
const SONNET_THINKING = ["low", "high"] as const;
const OPUS_THINKING = ["low", "high"] as const;
const OSS_THINKING = ["low", "medium"] as const;

export const defaultModelProviders: readonly ModelPickerProvider[] = [
  {
    id: "gemini",
    name: "Gemini",
    icon: <GeminiIcon className="size-4" />,
    models: [
      {
        id: "gemini-3.8-flash",
        name: "Gemini 3.8 Flash",
        description: "Recomendado: Máxima velocidad y eficacia",
        capabilities: ["reasoning", "image"],
        thinking: FLASH_THINKING,
        defaultThinking: "medium",
        usageLimit: {
          type: "unlimited",
          label: "Cuota Alta",
          description: "Cuota estándar de Gemini sin restricciones horarias",
        },
      },
      {
        id: "gemini-3.7-flash",
        name: "Gemini 3.7 Flash",
        description: "Velocidad híbrida con pensamiento adaptable",
        capabilities: ["reasoning", "image"],
        thinking: FLASH_THINKING,
        defaultThinking: "medium",
        usageLimit: {
          type: "unlimited",
          label: "Cuota Alta",
          description: "Cuota estándar de Gemini sin restricciones horarias",
        },
      },
      {
        id: "gemini-3.6-flash",
        name: "Gemini 3.6 Flash",
        description: "Modelo eficiente optimizado para flujos rápidos",
        capabilities: ["reasoning", "image"],
        thinking: FLASH_THINKING,
        defaultThinking: "medium",
        usageLimit: {
          type: "unlimited",
          label: "Cuota Alta",
          description: "Cuota estándar de Gemini sin restricciones horarias",
        },
      },
      {
        id: "gemini-3.1-pro",
        name: "Gemini 3.1 Pro",
        description: "Razonamiento profundo para análisis complejo",
        capabilities: ["reasoning", "image"],
        thinking: PRO_THINKING,
        defaultThinking: "high",
        usageLimit: {
          type: "unlimited",
          label: "Cuota Alta",
          description: "Cuota pro de Gemini sin restricciones horarias",
        },
      },
    ],
  },
  {
    id: "claude",
    name: "Claude",
    icon: <ClaudeIcon className="size-4 text-[#D97757]" />,
    models: [
    ],
  },
  {
    id: "chatgpt",
    name: "GPT / OSS",
    icon: <OpenAIIcon className="size-4 text-[#10A37F]" />,
    models: [
      {
        id: "gpt-oss-120b-medium",
        name: "GPT-OSS 120B",
        description: "Modelo abierto de alta capacidad de 120B parámetros",
        capabilities: ["reasoning"],
        thinking: OSS_THINKING,
        defaultThinking: "medium",
        usageLimit: {
          type: "window",
          limit: 80,
          windowHours: 3,
          label: "80 msgs / 3h",
          description: "Ventana de 80 mensajes cada 3 horas",
        },
      },
    ],
  },
];

function isAvailable(model: ModelPickerModel) {
  return model.available !== false;
}

function visibleModels(provider: ModelPickerProvider) {
  return provider.models.filter(isAvailable);
}

function visibleProviders(providers: readonly ModelPickerProvider[]) {
  return providers.filter((provider) => visibleModels(provider).length > 0);
}

function matchesQuery(
  model: ModelPickerModel,
  provider: ModelPickerProvider,
  query: string,
) {
  return [model.name, model.id, model.description ?? "", provider.name].some(
    (field) => field.toLowerCase().includes(query),
  );
}

function findModel(
  providers: readonly ModelPickerProvider[],
  modelId: string | undefined,
) {
  if (!modelId) return undefined;
  for (const provider of providers) {
    const model = provider.models.find((item) => item.id === modelId);
    if (model) return { provider, model };
  }
  return undefined;
}

function ProviderGlyph({
  provider,
  className,
}: {
  provider: ModelPickerProvider;
  className?: string;
}) {
  if (provider.icon) {
    return (
      <span className={cn("inline-flex size-4 items-center justify-center [&>svg]:size-full", className)}>
        {provider.icon}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-4 items-center justify-center text-[11px] font-medium leading-none",
        className,
      )}
    >
      {provider.name.charAt(0)}
    </span>
  );
}

function CapabilityChips({
  capabilities,
}: {
  capabilities?: readonly ModelCapability[];
}) {
  if (!capabilities?.length) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-1 ring-1 ring-inset ring-border/70">
      {capabilities.map((capability, index) => {
        const Icon = CAPABILITY_ICON[capability];
        const label = CAPABILITY_LABEL[capability];
        return (
          <Fragment key={capability}>
            {index > 0 ? (
              <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border/70" />
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  aria-label={label}
                  className={cn(
                    "inline-flex size-4 items-center justify-center opacity-90 transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:opacity-100 motion-reduce:transition-none",
                    CAPABILITY_ACCENT[capability],
                  )}
                >
                  <Icon aria-hidden="true" className="size-3" strokeWidth={2} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {label}
              </TooltipContent>
            </Tooltip>
          </Fragment>
        );
      })}
    </span>
  );
}

function EffortMeter({
  levels,
  filled,
  className,
}: {
  levels: readonly ThinkingEffort[];
  filled: number;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={cn("flex items-end gap-0.5", className)}>
      {levels.map((effort, index) => (
        <span
          key={effort}
          style={{ height: `${5 + index * 2.5}px` }}
          className={cn(
            "w-0.75 rounded-full transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            index < filled ? "bg-foreground" : "bg-border",
          )}
        />
      ))}
    </span>
  );
}

function ThinkingTrack({
  levels,
  value,
  onChange,
}: {
  levels: readonly ThinkingEffort[];
  value?: ThinkingEffort;
  onChange: (effort: ThinkingEffort) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const current = value && levels.includes(value) ? value : levels[0];
  const activeIndex = Math.max(0, levels.indexOf(current));

  function move(index: number) {
    const next = (index + levels.length) % levels.length;
    onChange(levels[next]);
    refs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      move(activeIndex + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      move(activeIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      move(0);
    } else if (event.key === "End") {
      event.preventDefault();
      move(levels.length - 1);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Thinking effort"
      className="relative flex min-w-0 flex-1 items-center rounded-full bg-muted/60 p-1 ring-1 ring-inset ring-border/60"
    >
      <span
        aria-hidden="true"
        style={{
          width: `calc((100% - 0.5rem) / ${levels.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
        className="pointer-events-none absolute inset-y-1 left-1 rounded-full bg-popover ring-1 ring-inset ring-border/70 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
      />
      {levels.map((effort, index) => {
        const active = index === activeIndex;
        return (
          <button
            key={effort}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            ref={(node) => {
              refs.current[index] = node;
            }}
            onClick={() => onChange(effort)}
            onKeyDown={onKeyDown}
            className={cn(
              "relative z-10 min-w-0 flex-1 cursor-pointer touch-manipulation rounded-full px-1.5 py-1.5 text-center text-[11px] font-medium leading-none text-muted-foreground transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none",
              active && "text-foreground",
            )}
          >
            {THINKING_LABEL[effort]}
          </button>
        );
      })}
    </div>
  );
}

export function ModelPicker({
  providers,
  value,
  defaultValue,
  onValueChange,
  thinking,
  defaultThinking,
  closeOnSelect = false,
  open,
  defaultOpen = false,
  onOpenChange,
  side = "bottom",
  align = "start",
  placeholder = "Seleccionar modelo",
  className,
}: ModelPickerProps) {
  const listId = useId();
  const rails = useMemo(() => visibleProviders(providers), [providers]);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [internalValue, setInternalValue] = useState(defaultValue ?? "gemini-3.8-flash-medium");
  const selectedId = value ?? internalValue;
  const isOpen = open ?? internalOpen;
  const selected = findModel(providers, selectedId);
  const [internalThinking, setInternalThinking] = useState<ThinkingEffort | undefined>(
    defaultThinking ?? selected?.model.defaultThinking,
  );
  const selectedThinking = thinking ?? internalThinking;

  const selectedProviderId = selected?.provider.id;

  const [activeProviderId, setActiveProviderId] = useState(
    () => findModel(providers, selectedId)?.provider.id ?? rails[0]?.id ?? "",
  );

  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();
  const searching = search.length > 0;

  const activeProvider =
    rails.find((provider) => provider.id === activeProviderId) ?? rails[0];

  const rows = useMemo(() => {
    if (searching) {
      return rails.flatMap((provider) =>
        visibleModels(provider)
          .filter((model) => matchesQuery(model, provider, search))
          .map((model) => ({ provider, model })),
      );
    }
    if (!activeProvider) return [];
    return visibleModels(activeProvider).map((model) => ({
      provider: activeProvider,
      model,
    }));
  }, [activeProvider, rails, search, searching]);

  const activeModelIndex = Math.max(
    0,
    rows.findIndex((row) => row.model.id === selectedId),
  );

  const providerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const modelRefs = useRef<Array<HTMLElement | null>>([]);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || searching) return;
    const index = rails.findIndex(
      (provider) => provider.id === selectedProviderId,
    );
    if (index < 0) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        const button = providerRefs.current[index];
        const rail = railRef.current;
        if (!button || !rail) return;
        if (rail.scrollHeight <= rail.clientHeight) return;
        const offset =
          button.offsetTop - (rail.clientHeight - button.offsetHeight) / 2;
        rail.scrollTop = Math.max(0, offset);
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [isOpen, rails, searching, selectedProviderId]);

  const changeOpen = useCallback(
    (next: boolean) => {
      setInternalOpen(next);
      onOpenChange?.(next);
      setQuery("");
      if (next) {
        const owner = findModel(providers, selectedId)?.provider.id;
        if (owner) setActiveProviderId(owner);
      }
    },
    [onOpenChange, providers, selectedId],
  );

  const selectModel = useCallback(
    (modelId: string, providerId: string) => {
      const found = findModel(providers, modelId)?.model;
      const effort = found?.defaultThinking ?? found?.thinking?.[0];
      setInternalValue(modelId);
      setInternalThinking(effort);
      onValueChange?.(modelId, providerId, effort);
      if (closeOnSelect) changeOpen(false);
    },
    [changeOpen, closeOnSelect, onValueChange, providers],
  );

  const selectThinking = useCallback(
    (effort: ThinkingEffort) => {
      setInternalThinking(effort);
      if (selected) {
        onValueChange?.(selected.model.id, selected.provider.id, effort);
      }
    },
    [onValueChange, selected],
  );

  function focusProvider(index: number) {
    const next = (index + rails.length) % rails.length;
    providerRefs.current[next]?.focus();
  }

  function focusModel(index: number) {
    if (rows.length === 0) return;
    const next = (index + rows.length) % rows.length;
    modelRefs.current[next]?.focus();
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusModel(0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const first = rows[0];
      if (first) selectModel(first.model.id, first.provider.id);
    } else if (event.key === "Escape" && query) {
      event.preventDefault();
      event.stopPropagation();
      setQuery("");
    }
  }

  function onRailKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusProvider(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusProvider(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusProvider(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusProvider(rails.length - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusModel(0);
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusModel(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusModel(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusModel(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusModel(rows.length - 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const railIndex = rails.findIndex((provider) => provider.id === activeProvider?.id);
      providerRefs.current[railIndex]?.focus();
    }
  }

  const thinkingLevels = selected?.model.thinking;
  const effortIndex = thinkingLevels && selectedThinking
    ? thinkingLevels.indexOf(selectedThinking)
    : -1;
  const filledSteps =
    !thinkingLevels || selectedThinking === "none" || effortIndex < 0
      ? 0
      : effortIndex + 1;
  const thinkingLabel =
    thinkingLevels && selectedThinking && selectedThinking !== "none"
      ? THINKING_LABEL[selectedThinking]
      : null;
  const triggerLabel = selected?.model.name ?? placeholder;

  return (
    <TooltipProvider delayDuration={250}>
      <Popover open={isOpen} onOpenChange={changeOpen}>
        <PopoverTrigger
          type="button"
          aria-label={triggerLabel}
          aria-haspopup="listbox"
          className={cn(
            "inline-flex h-9 max-w-full cursor-pointer touch-manipulation items-center gap-2 rounded-full bg-transparent px-3 text-sm font-semibold tracking-tight text-gray-200 transition-colors duration-200 hover:bg-white/10 hover:text-white active:scale-[0.98]",
            className,
          )}
        >
          <span className="min-w-0 truncate" translate="no">
            {triggerLabel}
          </span>
          <AIContextMeter
            limit={selected?.model?.id?.includes("pro") ? 2_000_000 : 1_000_000}
            used={124_000}
            breakdown={[
              { label: "System prompt", tokens: 1800 },
              { label: "Page context", tokens: 4200 },
              { label: "Conversation", tokens: 96000 },
              { label: "Attached files", tokens: 22000 },
            ]}
          />
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 shrink-0 text-gray-400 transition-transform duration-200"
          />
        </PopoverTrigger>
        <PopoverContent
          side={side}
          align={align}
          sideOffset={10}
          avoidCollisions={false}
          className="max-h-[calc(100dvh-2rem)] w-[min(26rem,calc(100vw-1.5rem))] gap-0 overflow-hidden overscroll-contain rounded-xl p-0 bg-[#212121] border border-[#383838] text-gray-100 shadow-2xl"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() => {
              searchRef.current?.focus();
            });
          }}
        >
          {rails.length === 0 || !activeProvider ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No models available</p>
          ) : (
            <div className="flex min-w-0 flex-col">
              <div className="flex min-h-48 bg-[#171717]">
                <div className="relative w-12 shrink-0 bg-[#171717]">
                  <div
                    role="tablist"
                    aria-label="Providers"
                    aria-orientation="vertical"
                    ref={railRef}
                    className={cn(
                      "absolute inset-0 flex flex-col gap-1.5 overflow-y-auto overscroll-contain p-1.5",
                      HIDDEN_SCROLLBAR,
                    )}
                  >
                    {rails.map((provider, index) => {
                      const selectedRail = provider.id === activeProvider.id;
                      return (
                        <Tooltip key={provider.id}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              role="tab"
                              id={`${listId}-tab-${provider.id}`}
                              aria-label={provider.name}
                              aria-selected={selectedRail}
                              tabIndex={selectedRail ? 0 : -1}
                              ref={(node) => {
                                providerRefs.current[index] = node;
                              }}
                              onClick={() => {
                                setQuery("");
                                setActiveProviderId(provider.id);
                              }}
                              onKeyDown={(event) => onRailKeyDown(event, index)}
                              className={cn(
                                "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-gray-400 hover:bg-[#2A2A2A] hover:text-white transition-colors",
                                selectedRail && !searching && "bg-[#212121] text-white ring-1 ring-white/10",
                              )}
                            >
                              <ProviderGlyph provider={provider} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs">
                            {provider.name}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 flex-col bg-[#212121]">
                  <div className="flex shrink-0 items-center gap-2 bg-[#171717] px-3 py-2 border-b border-[#303030]">
                    <Search className="size-3.5 shrink-0 text-gray-400" strokeWidth={2} />
                    <input
                      ref={searchRef}
                      type="text"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={onSearchKeyDown}
                      placeholder="Buscar modelos"
                      className="h-6 w-full min-w-0 bg-transparent text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none"
                    />
                    {query ? (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          searchRef.current?.focus();
                        }}
                        className="inline-flex size-5 items-center justify-center rounded-full text-gray-400 hover:text-white"
                      >
                        <X className="size-3" strokeWidth={2} />
                      </button>
                    ) : null}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col p-2">
                    <p className="px-2.5 pb-1.5 pt-1 text-[11px] text-gray-400">
                      {searching ? `${rows.length} resultados` : activeProvider.name}
                    </p>
                    <div
                      role="listbox"
                      id={listId}
                      className={cn(
                        "flex max-h-56 min-w-0 flex-col gap-1 overflow-y-auto pr-1",
                        THIN_SCROLLBAR,
                      )}
                    >
                      {rows.map(({ provider, model }, index) => {
                        const isSelected = model.id === selectedId;
                        return (
                          <div
                            key={model.id}
                            role="option"
                            aria-selected={isSelected}
                            tabIndex={index === activeModelIndex ? 0 : -1}
                            ref={(node) => {
                              modelRefs.current[index] = node;
                            }}
                            onClick={() => selectModel(model.id, provider.id)}
                            className={cn(
                              "flex min-h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[#2A2A2A] transition-colors",
                              isSelected && "bg-[#2F2F2F]",
                            )}
                          >
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="flex items-center gap-1.5 text-sm font-medium text-gray-100">
                                {model.name}
                                {isSelected ? <Check className="size-3.5 text-cyan-400" /> : null}
                                {model.usageLimit ? (
                                  model.usageLimit.type === "unlimited" ? (
                                    <span
                                      title={model.usageLimit.description ?? "Cuota Alta"}
                                      className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20"
                                    >
                                      <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]" />
                                      <span>{model.usageLimit.label}</span>
                                    </span>
                                  ) : (
                                    <span
                                      title={model.usageLimit.description ?? "Límite por ventana horaria"}
                                      className={cn(
                                        "ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                                        model.usageLimit.limit && model.usageLimit.limit <= 25
                                          ? "bg-rose-500/10 text-rose-300 ring-rose-500/25"
                                          : model.id.includes("claude")
                                            ? "bg-amber-500/10 text-amber-300 ring-amber-500/25"
                                            : "bg-cyan-500/10 text-cyan-300 ring-cyan-500/25"
                                      )}
                                    >
                                      <span className="inline-block h-1 w-4 overflow-hidden rounded-full bg-white/10">
                                        <span
                                          className={cn(
                                            "block h-full rounded-full",
                                            model.usageLimit.limit && model.usageLimit.limit <= 25
                                              ? "bg-gradient-to-r from-rose-500 to-amber-500 w-4/5"
                                              : "bg-gradient-to-r from-amber-500 to-emerald-500 w-full"
                                          )}
                                        />
                                      </span>
                                      <span className="font-mono text-[9px]">{model.usageLimit.label}</span>
                                    </span>
                                  )
                                ) : model.usageRating ? (
                                  <span
                                    title={`Frecuencia de uso: ${model.usageRating}%`}
                                    className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-400 ring-1 ring-inset ring-white/10"
                                  >
                                    <span className="inline-block h-1 w-5 overflow-hidden rounded-full bg-white/10">
                                      <span
                                        className="block h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                                        style={{ width: `${model.usageRating}%` }}
                                      />
                                    </span>
                                    <span className="font-mono text-[9px] text-gray-300">{model.usageRating}%</span>
                                  </span>
                                ) : null}
                              </span>
                              {model.description ? (
                                <span className="truncate text-[11px] text-gray-400">
                                  {model.description}
                                </span>
                              ) : null}
                            </span>
                            <CapabilityChips capabilities={model.capabilities} />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 border-t border-[#303030] bg-[#1a1a1a] p-2 sm:flex-row sm:items-center sm:gap-3 sm:px-3">
                    <span className="flex shrink-0 items-center gap-2">
                      <EffortMeter levels={thinkingLevels ?? FULL_THINKING} filled={filledSteps} />
                      <span className="text-[11px] text-gray-400">Thinking</span>
                    </span>
                    {thinkingLevels?.length ? (
                      <ThinkingTrack
                        levels={thinkingLevels}
                        value={selectedThinking}
                        onChange={selectThinking}
                      />
                    ) : (
                      <span className="text-[11px] text-gray-500">No aplicable</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}

export default ModelPicker;
