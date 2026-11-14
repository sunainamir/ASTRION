import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpCircle,
  Zap,
} from "lucide-react";
import { useEffect } from "react";
import {
  resetVirtualInput,
  setVirtualKey,
  type VirtualInputState,
} from "../game/virtualInput";

function TouchHoldButton({
  inputKey,
  label,
  className = "touch-pad-btn",
  children,
}: {
  inputKey: keyof VirtualInputState;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const activate = (e: React.PointerEvent) => {
    e.preventDefault();
    setVirtualKey(inputKey, true);
  };
  const release = (e: React.PointerEvent) => {
    e.preventDefault();
    setVirtualKey(inputKey, false);
  };

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      onPointerDown={activate}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

export default function TouchControls({
  mode,
}: {
  mode: "flight" | "lunar";
}) {
  useEffect(() => {
    const clear = () => resetVirtualInput();
    window.addEventListener("blur", clear);
    window.addEventListener("pointercancel", clear);
    return () => {
      clear();
      window.removeEventListener("blur", clear);
      window.removeEventListener("pointercancel", clear);
    };
  }, [mode]);

  return (
    <div className="touch-controls-layer" aria-label="Touch gameplay controls">
      <div className="touch-dpad">
        <div className="touch-dpad-row">
          <TouchHoldButton inputKey="up" label={mode === "flight" ? "Pitch up" : "Walk forward"}>
            <ArrowUp size={18} />
          </TouchHoldButton>
        </div>
        <div className="touch-dpad-row">
          <TouchHoldButton inputKey="left" label={mode === "flight" ? "Steer left" : "Strafe left"}>
            <ArrowLeft size={18} />
          </TouchHoldButton>
          <TouchHoldButton inputKey="down" label={mode === "flight" ? "Pitch down" : "Walk backward"}>
            <ArrowDown size={18} />
          </TouchHoldButton>
          <TouchHoldButton inputKey="right" label={mode === "flight" ? "Steer right" : "Strafe right"}>
            <ArrowRight size={18} />
          </TouchHoldButton>
        </div>
      </div>

      <div className="touch-action-col">
        {mode === "flight" ? (
          <TouchHoldButton
            inputKey="boost"
            label="Thruster boost"
            className="touch-action-btn"
          >
            <Zap size={16} /> BOOST
          </TouchHoldButton>
        ) : (
          <TouchHoldButton
            inputKey="jump"
            label="Low-gravity hop"
            className="touch-action-btn"
          >
            <ArrowUpCircle size={16} /> HOP
          </TouchHoldButton>
        )}
      </div>
    </div>
  );
}
