"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/* =========================
   Utils
   ========================= */
type Offset = { x: number; y: number };

const setHiDPICanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
  const parent = canvas.parentElement;
  const cw = (parent?.clientWidth ?? window.innerWidth) | 0;
  const ch = (parent?.clientHeight ?? window.innerHeight) | 0;
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  canvas.width = Math.floor(cw * dpr);
  canvas.height = Math.floor(ch * dpr);
  canvas.style.width = cw + "px";
  canvas.style.height = ch + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};

const originFromOffset = (offset: Offset, cell: number) => ({
  x: -((offset.x % cell) + cell) % cell,
  y: -((offset.y % cell) + cell) % cell,
});

/* =========================
   Film grain (Noise)
   ========================= */
export const Noise: React.FC<{ refresh?: number; alpha?: number; className?: string }> = ({
  refresh = 2,
  alpha = 10,
  className = "",
}) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d", { alpha: true });
    if (!ctx) return;

    let f = 0;
    let id = 0;
    const S = 1024;

    const resize = () => {
      c.width = S;
      c.height = S;
      c.style.width = "100vw";
      c.style.height = "100vh";
    };

    const draw = () => {
      const img = ctx.createImageData(S, S);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() * 255;
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
        d[i + 3] = alpha;
      }
      ctx.putImageData(img, 0, 0);
    };

    const loop = () => {
      if (f % refresh === 0) draw();
      f++;
      id = requestAnimationFrame(loop);
    };

    resize();
    loop();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(id);
    };
  }, [refresh, alpha]);

  return (
    <canvas
      ref={ref}
      className={cn(
        "pointer-events-none fixed inset-0 z-30 h-full w-full opacity-35 mix-blend-overlay",
        className,
      )}
    />
  );
};

/* =========================
   Single Clean Blueprint Grid Lines (Static or Animated)
   ========================= */
interface GridProps {
  squareSize: number;
  borderColor?: string;
  gridOffsetRef: React.MutableRefObject<Offset>;
  vignette?: boolean;
  className?: string;
}

export const MovingGrid: React.FC<GridProps> = ({
  squareSize,
  borderColor = "rgba(255, 255, 255, 0.018)",
  gridOffsetRef,
  vignette = true,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      ctx.clearRect(0, 0, cw, ch);

      const origin = originFromOffset(gridOffsetRef.current, squareSize);

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;

      for (let x = origin.x; x <= cw + squareSize; x += squareSize) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, ch);
        ctx.stroke();
      }

      for (let y = origin.y; y <= ch + squareSize; y += squareSize) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(cw, y + 0.5);
        ctx.stroke();
      }

      if (vignette) {
        const grad = ctx.createRadialGradient(
          cw / 2,
          ch / 2,
          0,
          cw / 2,
          ch / 2,
          Math.sqrt(cw * cw + ch * ch) / 2,
        );
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, "rgba(0,0,0,0.40)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cw, ch);
      }

      raf.current = requestAnimationFrame(draw);
    };

    const resize = () => setHiDPICanvas(canvas, ctx);
    resize();
    raf.current = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [squareSize, borderColor, vignette, gridOffsetRef]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("block h-full w-full border-none", className)}
    />
  );
};

/* =========================
   Interactive Mouse Square Trail
   ========================= */
interface HoverProps {
  squareSize: number;
  hoverFillColor?: string;
  hoverStrokeColor?: string;
  hoverGlowColor?: string;
  gridOffsetRef: React.MutableRefObject<Offset>;
  className?: string;
}

export const SquaresInteractive: React.FC<HoverProps> = ({
  squareSize,
  hoverFillColor = "rgba(37, 99, 235, 0.12)",
  hoverStrokeColor = "rgba(147, 197, 253, 0.28)",
  hoverGlowColor = "rgba(59, 130, 246, 0.45)",
  gridOffsetRef,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<Map<string, { gx: number; gy: number; alpha: number }>>(new Map());
  const raf = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.style.pointerEvents = "auto";
    canvas.style.cursor = "crosshair";
    canvas.style.background = "transparent";

    const draw = () => {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      ctx.clearRect(0, 0, cw, ch);

      const origin = originFromOffset(gridOffsetRef.current, squareSize);
      const decay = 0.022; // ~750ms decay

      trailRef.current.forEach((cell, key) => {
        cell.alpha -= decay;
        if (cell.alpha <= 0.01) {
          trailRef.current.delete(key);
          return;
        }

        const cellX = origin.x + cell.gx * squareSize;
        const cellY = origin.y + cell.gy * squareSize;
        const a = cell.alpha;

        // Glow + Fill
        ctx.save();
        ctx.shadowBlur = 10 * a;
        ctx.shadowColor = `rgba(59, 130, 246, ${0.45 * a})`;
        ctx.fillStyle = `rgba(37, 99, 235, ${0.12 * a})`;
        ctx.fillRect(cellX, cellY, squareSize, squareSize);
        ctx.restore();

        // Transparent, soft square border
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(147, 197, 253, ${0.28 * a})`;
        ctx.strokeRect(cellX + 0.5, cellY + 0.5, squareSize - 1, squareSize - 1);

        // Inner soft reflection sheen
        const grad = ctx.createLinearGradient(cellX, cellY, cellX, cellY + squareSize);
        grad.addColorStop(0, `rgba(255,255,255,${0.14 * a})`);
        grad.addColorStop(1, `rgba(255,255,255,${0.01 * a})`);
        ctx.fillStyle = grad;
        ctx.fillRect(cellX, cellY, squareSize, squareSize);
      });

      raf.current = requestAnimationFrame(draw);
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (mouseX < 0 || mouseY < 0 || mouseX > canvas.clientWidth || mouseY > canvas.clientHeight) {
        return;
      }

      const origin = originFromOffset(gridOffsetRef.current, squareSize);
      const gx = Math.floor((mouseX - origin.x) / squareSize);
      const gy = Math.floor((mouseY - origin.y) / squareSize);
      const key = `${gx},${gy}`;
      trailRef.current.set(key, { gx, gy, alpha: 1.0 });
    };

    const resize = () => setHiDPICanvas(canvas, ctx);

    resize();
    raf.current = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [squareSize, hoverFillColor, hoverStrokeColor, hoverGlowColor, gridOffsetRef]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("block h-full w-full border-none", className)}
    />
  );
};

/* =========================
   Final Combined Component: Blueprint Gradient Mesh
   Black-to-Blue background with single clean grid & interactive mouse square trail.
   ========================= */
export type Direction = "right" | "left" | "up" | "down" | "diagonal";

export interface BlueprintGradientMeshProps {
  children?: React.ReactNode;
  showGrid?: boolean;
  showNoise?: boolean;
  direction?: Direction;
  speed?: number;
  squareSize?: number;

  // Grid
  borderColor?: string;
  vignette?: boolean;

  // Hover Trail
  hoverFillColor?: string;
  hoverStrokeColor?: string;
  hoverGlowColor?: string;

  // Background options
  baseColor?: string;
  backgroundImage?: string;

  className?: string;
}

export function BlueprintGradientMesh({
  children,
  showGrid = true,
  showNoise = false,
  direction = "diagonal",
  speed = 0, // Static grid by default to eliminate double/moving grid
  squareSize = 44,
  borderColor = "rgba(255, 255, 255, 0.018)",
  vignette = true,
  hoverFillColor = "rgba(37, 99, 235, 0.12)",
  hoverStrokeColor = "rgba(147, 197, 253, 0.28)",
  hoverGlowColor = "rgba(59, 130, 246, 0.45)",
  baseColor = "#000000",
  backgroundImage = "/bg-gradient-blue.png",
  className,
}: BlueprintGradientMeshProps) {
  const gridOffsetRef = useRef<Offset>({ x: 0, y: 0 });
  const raf = useRef<number>();

  useEffect(() => {
    if (speed <= 0) return;
    const v = speed;
    const s = squareSize;
    const tick = () => {
      switch (direction) {
        case "right":
          gridOffsetRef.current.x = (gridOffsetRef.current.x - v + s) % s;
          break;
        case "left":
          gridOffsetRef.current.x = (gridOffsetRef.current.x + v + s) % s;
          break;
        case "up":
          gridOffsetRef.current.y = (gridOffsetRef.current.y - v + s) % s;
          break;
        case "down":
          gridOffsetRef.current.y = (gridOffsetRef.current.y + v + s) % s;
          break;
        case "diagonal":
        default:
          gridOffsetRef.current.x = (gridOffsetRef.current.x - v + s) % s;
          gridOffsetRef.current.y = (gridOffsetRef.current.y - v + s) % s;
          break;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [direction, speed, squareSize]);

  return (
    <div
      className={cn("fixed inset-0 -z-10 overflow-hidden", className)}
      style={{
        backgroundColor: baseColor,
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center bottom",
        backgroundSize: "cover",
      }}
    >
      {/* 1. Single Clean Blueprint Grid Canvas */}
      {showGrid && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <MovingGrid
            borderColor={borderColor}
            gridOffsetRef={gridOffsetRef}
            squareSize={squareSize}
            vignette={vignette}
          />
        </div>
      )}

      {/* 2. Interactive Mouse Trail Canvas */}
      <div className="absolute inset-0 z-20">
        <SquaresInteractive
          gridOffsetRef={gridOffsetRef}
          hoverFillColor={hoverFillColor}
          hoverGlowColor={hoverGlowColor}
          hoverStrokeColor={hoverStrokeColor}
          squareSize={squareSize}
        />
      </div>

      {/* 3. Optional Film Grain Noise */}
      {showNoise && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <Noise alpha={8} refresh={2} />
        </div>
      )}

      {/* 4. Subtle Radial Vignette for Depth */}
      <div
        className="pointer-events-none absolute inset-0 z-40"
        style={{
          background: "radial-gradient(ellipse at 50% 35%, transparent 55%, rgba(0, 0, 0, 0.45) 100%)",
        }}
      />

      {/* Children Layer */}
      {children && <div className="relative z-50 h-full w-full">{children}</div>}
    </div>
  );
}

export default BlueprintGradientMesh;
