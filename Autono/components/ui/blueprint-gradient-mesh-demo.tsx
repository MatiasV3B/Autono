import BlueprintGradientMesh from "@/components/ui/blueprint-gradient-mesh";

export default function BlueprintGradientMeshDemo() {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-6 text-white">
      <BlueprintGradientMesh />
      <div className="relative z-50 max-w-md rounded-2xl border border-white/10 bg-black/40 p-8 backdrop-blur-xl text-center shadow-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Blueprint Gradient Mesh
        </h1>
        <p className="text-sm text-neutral-400">
          Combina el resplandor radial <span className="text-purple-300 font-mono">#d5c5ff</span> con la cuadrícula blueprint interactiva animada.
        </p>
      </div>
    </div>
  );
}
