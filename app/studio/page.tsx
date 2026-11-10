import { getStudioRun } from "../../lib/studio/run-store";
import type { LiveRunState } from "../../lib/studio/types";
import StudioShell from "./studio-shell";
import "./studio.css";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const params = await searchParams;
  const runId = typeof params.run === "string" ? params.run : undefined;
  const liveRun = runId ? getStudioRun(runId) : undefined;
  const liveRunState: LiveRunState = !runId ? "none" : liveRun ? "loaded" : "expired";

  return (
    <StudioShell
      key={runId ?? "samples"}
      aiEnabled={Boolean(process.env.OPENAI_API_KEY?.trim())}
      licenseKey={process.env.AG_STUDIO_LICENSE_KEY}
      liveRun={liveRun}
      liveRunState={liveRunState}
      requestedRunId={runId}
    />
  );
}
