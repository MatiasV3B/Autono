import { FloatingPathsBackground } from "@/components/ui/floating-paths";

export default function FloatingPathsBackgroundExample() {
  return (
    <FloatingPathsBackground
      className="aspect-16/9 flex items-center justify-center min-h-[300px]"
      position={-1}
    >
      <div className="z-10 text-center">
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Floating Paths</h2>
        <p className="text-sm text-neutral-500">Elegante fondo procedural animado</p>
      </div>
    </FloatingPathsBackground>
  );
}
