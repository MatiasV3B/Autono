"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function FloatingPathsBackground({
  children,
  className,
}: {
  position?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("w-full h-full relative overflow-hidden bg-[#16171a]", className)}>
      {/* Ambient Aurora Glow Orbs */}
      <div className="absolute inset-0 pointer-events-none filter blur-[85px] opacity-80 overflow-hidden">
        <motion.div
          animate={{
            x: [0, 45, -35, 0],
            y: [0, 40, 20, 0],
            scale: [1, 1.12, 0.94, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[12%] left-[8%] w-[420px] h-[420px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(56, 189, 248, 0.28) 0%, rgba(37, 99, 235, 0.12) 50%, transparent 75%)",
          }}
        />
        <motion.div
          animate={{
            x: [0, -50, 30, 0],
            y: [0, -35, 40, 0],
            scale: [1, 1.14, 0.92, 1],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[32%] -right-[8%] w-[460px] h-[460px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(168, 85, 247, 0.24) 0%, rgba(217, 70, 239, 0.08) 50%, transparent 75%)",
          }}
        />
        <motion.div
          animate={{
            x: [0, -40, 40, 0],
            y: [0, 30, -25, 0],
            scale: [1, 1.10, 0.95, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-[8%] left-[18%] w-[440px] h-[400px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(168, 85, 247, 0.20) 0%, rgba(56, 189, 248, 0.10) 50%, transparent 75%)",
          }}
        />
      </div>

      {/* High-Tech Matrix Vignette Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-80"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255, 255, 255, 0.055) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(ellipse at 50% 45%, black 20%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 45%, black 20%, transparent 80%)",
        }}
      />

      {/* Fluid Ethereal Gravitational Wave Ribbons */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="w-full h-full object-cover opacity-90" viewBox="0 0 1200 800" fill="none" preserveAspectRatio="none">
          <defs>
            <linearGradient id="ag-react-brand-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="ag-react-brand-grad-2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#c084fc" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.7" />
            </linearGradient>
            <linearGradient id="ag-react-brand-grad-3" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.75" />
              <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.65" />
            </linearGradient>
            <linearGradient id="ag-react-soft-ribbon" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.08" />
              <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {/* Soft Flowing Aura Ribbon Fill */}
          <path
            d="M -50 260 C 250 160, 520 360, 850 200 C 1050 110, 1150 260, 1250 210 L 1250 320 C 1150 370, 1050 220, 850 310 C 520 440, 250 240, -50 340 Z"
            fill="url(#ag-react-soft-ribbon)"
          />

          {/* Continuous Gravitational Wave Ribbons */}
          <motion.path
            d="M -60 140 C 280 240, 580 90, 880 180 C 1060 230, 1160 130, 1260 160"
            stroke="url(#ag-react-brand-grad-2)"
            strokeWidth="1.6"
            strokeOpacity="0.26"
            animate={{ y: [0, -16, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d="M -60 260 C 250 160, 520 360, 850 200 C 1050 110, 1150 260, 1260 210"
            stroke="url(#ag-react-brand-grad-1)"
            strokeWidth="2.0"
            strokeOpacity="0.38"
            animate={{ y: [0, 18, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d="M -60 420 C 200 540, 480 320, 800 480 C 1020 580, 1160 410, 1260 450"
            stroke="url(#ag-react-brand-grad-2)"
            strokeWidth="2.2"
            strokeOpacity="0.34"
            animate={{ y: [0, -22, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d="M -60 590 C 320 440, 560 710, 880 530 C 1080 410, 1170 580, 1260 530"
            stroke="url(#ag-react-brand-grad-3)"
            strokeWidth="1.8"
            strokeOpacity="0.30"
            animate={{ y: [0, 15, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d="M -60 730 C 220 830, 520 620, 820 760 C 1020 830, 1160 690, 1260 720"
            stroke="url(#ag-react-brand-grad-1)"
            strokeWidth="1.7"
            strokeOpacity="0.24"
            animate={{ y: [0, 18, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>
      </div>

      {children}
    </div>
  );
}
