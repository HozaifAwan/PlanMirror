import StudioShell from "./studio-shell";
import "./studio.css";

export default function StudioPage() { return <StudioShell licenseKey={process.env.AG_STUDIO_LICENSE_KEY} />; }
