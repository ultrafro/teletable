import { Html } from "@react-three/drei";

interface ControlSlidersProps {
  wristValue: number;
  gripperValue: number;
  pitchValue: number;
  onWristChange: (value: number) => void;
  onGripperChange: (value: number) => void;
  onPitchChange: (value: number) => void;
  position?: [number, number, number];
  handId?: string;
  color?: string;
}

export default function ControlSliders({
  handId,
  wristValue,
  gripperValue,
  pitchValue,
  onWristChange,
  onGripperChange,
  onPitchChange,
  position = [0, 0.1, 0],
  color,
}: ControlSlidersProps) {
  return (
    <Html
      position={position}
      style={{
        width: "200px",
        background: "rgba(0, 0, 0, 0.8)",
        padding: "10px",
        borderRadius: "8px",
        border: "1px solid #333",
        transform: "translateX(-50%)",
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ marginBottom: "10px" }}>
        <span style={{ color: color }}>Hand: {handId}</span>
        <label
          style={{
            color: "white",
            fontSize: "12px",
            display: "block",
            marginBottom: "5px",
          }}
        >
          Wrist: {wristValue.toFixed(2)}
        </label>
        <input
          type="range"
          min="-180"
          max="180"
          value={wristValue}
          onChange={(e) => onWristChange(parseFloat(e.target.value))}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            height: "6px",
            background: "#333",
            outline: "none",
            borderRadius: "3px",
          }}
        />
      </div>
      <div style={{ marginBottom: "10px" }}>
        <label
          style={{
            color: "white",
            fontSize: "12px",
            display: "block",
            marginBottom: "5px",
          }}
        >
          Pitch: {pitchValue.toFixed(2)}
        </label>
        <input
          type="range"
          min="-90"
          max="90"
          value={pitchValue}
          onChange={(e) => onPitchChange(parseFloat(e.target.value))}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            height: "6px",
            background: "#333",
            outline: "none",
            borderRadius: "3px",
          }}
        />
      </div>
      <div>
        <label
          style={{
            color: "white",
            fontSize: "12px",
            display: "block",
            marginBottom: "5px",
          }}
        >
          Gripper: {gripperValue.toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={gripperValue}
          onChange={(e) => onGripperChange(parseFloat(e.target.value))}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            height: "6px",
            background: "#333",
            outline: "none",
            borderRadius: "3px",
          }}
        />
      </div>
    </Html>
  );
}
