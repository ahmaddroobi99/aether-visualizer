import { createFileRoute } from "@tanstack/react-router";
import { VisualizerStage } from "@/components/visualizer/stage";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <VisualizerStage />;
}
