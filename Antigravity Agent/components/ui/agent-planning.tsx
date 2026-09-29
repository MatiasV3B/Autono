import React, { useState, useRef } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Loader2, 
  Check, 
  Search, 
  FileText, 
  BrainCircuit, 
  AlertTriangle, 
  Code, 
  TerminalSquare 
} from 'lucide-react';
import { cn } from "@/lib/utils";

export type PlanStepStatus = 'pending' | 'active' | 'success' | 'error';

export interface PlanStep {
  id: string;
  title: string;
  content?: React.ReactNode;
  status: PlanStepStatus;
  icon?: React.ReactNode;
  duration?: string;
  defaultExpanded?: boolean;
}

export interface AgentPlanningProps {
  title?: string;
  steps?: PlanStep[];
  className?: string;
}

export const Component = () => {
  const [count, setCount] = useState(0);

  return (
    <div className={cn("flex flex-col items-center gap-4 p-4 rounded-lg")}>
      <h1 className="text-2xl font-bold mb-2">Component Example</h1>
      <h2 className="text-xl font-semibold">{count}</h2>
      <div className="flex gap-2">
        <button onClick={() => setCount((prev) => prev - 1)}>-</button>
        <button onClick={() => setCount((prev) => prev + 1)}>+</button>
      </div>
    </div>
  );
};

export const DEFAULT_STEPS: PlanStep[] = [
  {
    id: '1',
    title: 'Analyze request and extract constraints',
    status: 'success',
    duration: '0.4s',
    icon: <Search className="w-3.5 h-3.5" />,
    content: (
      <div className="space-y-2 font-mono text-[11px] text-muted-foreground mt-2">
        <div className="flex items-start gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
          <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Parsed user intent: Build minimalist UI Component</span>
        </div>
        <div className="grid grid-cols-[80px_1fr] gap-1.5 mt-3 bg-secondary/30 p-2.5 rounded-md border border-border/50">
          <span className="text-foreground/50 font-medium">Language:</span>
          <span className="text-foreground">TypeScript, React</span>
          
          <span className="text-foreground/50 font-medium">Styling:</span>
          <span className="text-foreground">Tailwind CSS v4 (OKLCH variables)</span>
          
          <span className="text-foreground/50 font-medium">Constraints:</span>
          <span className="text-amber-600 dark:text-amber-400">Single-file, Interactive, No Overlaps</span>
        </div>
      </div>
    )
  },
  {
    id: '2',
    title: 'Search UI knowledge base',
    status: 'success',
    duration: '1.2s',
    icon: <FileText className="w-3.5 h-3.5" />,
    content: (
      <div className="space-y-3 font-mono text-[11px] mt-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Executing tool:</span>
          <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-semibold flex items-center gap-1">
            <TerminalSquare className="w-3 h-3" />
            vector_search
          </span>
        </div>
        <div className="p-3 rounded-md bg-card border border-border shadow-sm text-muted-foreground">
          <div className="text-emerald-600 dark:text-emerald-400 mb-2 font-semibold">Success: Retrieved 3 semantic patterns</div>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>Claude 3.5 Sonnet thinking block layout</li>
            <li>Tailwind v4 flex-timeline micro-interactions</li>
            <li>React state-driven accordions with smooth max-height</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: '3',
    title: 'Synthesize component logic',
    status: 'active',
    duration: '...',
    icon: <BrainCircuit className="w-3.5 h-3.5" />,
    defaultExpanded: true,
    content: (
      <div className="space-y-3 font-mono text-[11px] mt-2">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Generating structured timeline layout...</span>
        </div>
        
        <div className="relative rounded-md overflow-hidden bg-zinc-950 dark:bg-black/60 border border-border/50 p-3.5 shadow-inner">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-50" />
          <div className="text-zinc-400 space-y-1.5 leading-relaxed">
            <div><span className="text-purple-400">const</span> <span className="text-blue-300">timelineLayout</span> = <span className="text-yellow-300">useMemo</span>(...)</div>
            <div className="pl-4">- Fixing absolute positioning overlaps</div>
            <div className="pl-4">- Applying distinct icon columns</div>
            <div className="pl-4 text-zinc-300 font-medium animate-pulse flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-blue-400" />
              Injecting rich content panels |
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: '4',
    title: 'Review dependency conflicts',
    status: 'error',
    duration: '0.8s',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    content: (
      <div className="space-y-2 font-mono text-[11px] mt-2 animate-in fade-in zoom-in-95 duration-300">
        <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20">
          <div className="text-rose-600 dark:text-rose-400 font-bold mb-1 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Warning: Component styling deviation
          </div>
          <div className="text-rose-600/80 dark:text-rose-400/80 leading-relaxed">
            Previous absolute positioning caused icon overlaps. Sub-agent is resolving layout tree to a strict flex-row grid before continuing execution.
          </div>
        </div>
      </div>
    )
  },
  {
    id: '5',
    title: 'Execute final rendering',
    status: 'pending',
    icon: <Code className="w-3.5 h-3.5" />,
  }
];

export const AgentPlanning: React.FC<AgentPlanningProps> = ({
  title = "Agent is planning",
  steps = DEFAULT_STEPS,
  className,
}) => {
  const [isMainExpanded, setIsMainExpanded] = useState(true);
  
  // Track expanded state of individual step details
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>(
    steps.reduce((acc, step) => {
      acc[step.id] = step.defaultExpanded || false;
      return acc;
    }, {} as Record<string, boolean>)
  );

  const mainContentRef = useRef<HTMLDivElement>(null);

  const toggleStep = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSteps(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const hasActive = steps.some(s => s.status === 'active');
  const allSuccess = steps.every(s => s.status === 'success');

  const getStatusColor = (status: PlanStepStatus) => {
    switch (status) {
      case 'success': return 'bg-emerald-100 text-emerald-600 ring-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400';
      case 'active': return 'bg-blue-100 text-blue-600 ring-blue-500/30 dark:bg-blue-500/20 dark:text-blue-400';
      case 'error': return 'bg-rose-100 text-rose-600 ring-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400';
      case 'pending': return 'bg-secondary text-muted-foreground ring-border/50 dark:bg-secondary/50';
    }
  };

  return (
    <div className={cn("w-full max-w-2xl mx-auto my-4 font-sans text-foreground", className)}>
      {/* Outer Card Container */}
      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden transition-all duration-300">
        
        {/* Top Header / Trigger Badge */}
        <div 
          onClick={() => setIsMainExpanded(!isMainExpanded)}
          className={`flex items-center justify-between px-4 py-3.5 cursor-pointer transition-colors select-none
            ${isMainExpanded ? 'bg-secondary/30 border-b border-border/50' : 'hover:bg-secondary/30'}
          `}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-5 h-5">
              {hasActive ? (
                <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
              ) : allSuccess ? (
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <BrainCircuit className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            
            <span className="text-[15px] font-semibold text-foreground/90 tracking-tight">
              {title}
            </span>
          </div>

          <div className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-secondary text-muted-foreground transition-colors">
            {isMainExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </div>
        </div>

        {/* Expandable Main Timeline Area */}
        <div 
          className={`grid transition-all duration-500 ease-in-out bg-card ${
            isMainExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
          <div ref={mainContentRef} className="p-5 flex flex-col">
            
            {steps.map((step, index) => {
              const isStepExpanded = expandedSteps[step.id];
              const isLast = index === steps.length - 1;
              
              return (
                <div 
                  key={step.id} 
                  className={`relative flex gap-4 animate-in fade-in slide-in-from-top-4 duration-500 fill-mode-both
                    ${step.status === 'pending' ? 'opacity-60 grayscale' : 'opacity-100'}
                  `}
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  {/* Timeline connecting line */}
                  {!isLast && (
                    <div className="absolute left-[11px] top-7 bottom-[-10px] w-[2px] bg-border/60 z-0" />
                  )}

                  {/* Icon Column */}
                  <div className="relative z-10 flex-none w-6 h-6 mt-0.5">
                    <div className={`flex items-center justify-center w-full h-full rounded-full ring-4 ring-card transition-colors duration-300
                      ${getStatusColor(step.status)}
                    `}>
                      {step.status === 'success' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : step.status === 'active' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        step.icon || <div className="w-1.5 h-1.5 rounded-full bg-current" />
                      )}
                    </div>
                  </div>

                  {/* Content Column */}
                  <div className="flex-1 pb-6">
                    {/* Step Header */}
                    <div 
                      className={`flex items-center justify-between group rounded-md -mx-2 px-2 py-1 transition-colors
                        ${step.content ? 'cursor-pointer hover:bg-secondary/50' : ''}
                      `}
                      onClick={(e) => step.content && toggleStep(step.id, e)}
                    >
                      <span className={`text-[14px] tracking-tight transition-colors duration-200
                        ${step.status === 'active' ? 'text-foreground font-semibold' : 
                          step.status === 'error' ? 'text-rose-600 dark:text-rose-400 font-semibold' : 
                          'text-foreground/80 group-hover:text-foreground font-medium'}
                      `}>
                        {step.title}
                      </span>

                      <div className="flex items-center gap-3">
                        {step.duration && (
                          <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                            {step.duration}
                          </span>
                        )}
                        {step.content && (
                          <div className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors">
                            {isStepExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step Expanded Content */}
                    {step.content && (
                      <div 
                        className={`grid transition-all duration-400 ease-in-out ${
                          isStepExpanded ? 'grid-rows-[1fr] mt-2 opacity-100' : 'grid-rows-[0fr] mt-0 opacity-0'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="pt-1 pb-2">
                            {step.content}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentPlanning;
