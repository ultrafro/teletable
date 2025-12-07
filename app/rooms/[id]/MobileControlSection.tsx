import { MobileGoal } from "@/app/teletable.model";
import { MutableRefObject, useRef, useCallback, useEffect } from "react";
import { Joystick } from "./Joystick";

export function MobileControlSection({
  isInControl,
  mobileGoal,
  focusedRobot,
}: {
  isInControl: boolean;
  mobileGoal: MutableRefObject<MobileGoal>;
  focusedRobot: string | null;
}) {
  // if (!isInControl) {
  //   return null;
  // }

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-lg border border-gray-200 shadow-xl p-2">
      <div className="flex items-center justify-center gap-4">
        {/* Left: Wrist */}
        <ControlColumn
          label="Wrist"
          onChange={(delta: number) => {
            if (focusedRobot) {
              const minRoll = -180;
              const maxRoll = 180;
              const newRoll = Math.max(
                minRoll,
                Math.min(maxRoll, mobileGoal.current[focusedRobot].roll + delta)
              );
              mobileGoal.current[focusedRobot].roll += delta;
            }
          }}
          step={1}
        />

        {/* Left: Pitch */}
        <ControlColumn
          label="Pitch"
          onChange={(delta: number) => {
            if (focusedRobot) {
              const minPitch = -90;
              const maxPitch = 90;
              const newPitch = Math.max(
                minPitch,
                Math.min(
                  maxPitch,
                  mobileGoal.current[focusedRobot].pitch + delta
                )
              );
              mobileGoal.current[focusedRobot].pitch = newPitch;
            }
          }}
          step={1}
        />

        {/* Center: Joystick */}
        <div className="flex-shrink-0">
          <Joystick
            onChange={(deltaX: number, deltaY: number) => {
              if (focusedRobot) {
                const minX = -0.5;
                const maxX = 0.5;

                const minZ = -1;
                const maxZ = 0;

                const newX = Math.max(
                  minX,
                  Math.min(
                    maxX,
                    mobileGoal.current[focusedRobot].position.x + deltaX
                  )
                );
                const newZ = Math.max(
                  minZ,
                  Math.min(
                    maxZ,
                    mobileGoal.current[focusedRobot].position.z - deltaY
                  )
                );

                mobileGoal.current[focusedRobot].position.x = newX;
                mobileGoal.current[focusedRobot].position.z = newZ;
              }
            }}
            speed={0.01}
          />
        </div>

        {/* Right: Gripper */}
        <ControlColumn
          label="Gripper"
          onChange={(delta: number) => {
            if (focusedRobot) {
              const minGripper = 0;
              const maxGripper = 360;
              const newGripper = Math.max(
                minGripper,
                Math.min(
                  maxGripper,
                  mobileGoal.current[focusedRobot].gripper + delta
                )
              );
              mobileGoal.current[focusedRobot].gripper = newGripper;
            }
          }}
          step={1}
        />

        {/* Right: Height */}
        <ControlColumn
          label="Height"
          onChange={(delta: number) => {
            if (focusedRobot) {
              const minHeight = 0;
              const maxHeight = 1;
              const newHeight = Math.max(
                minHeight,
                Math.min(
                  maxHeight,
                  mobileGoal.current[focusedRobot].position.y + delta
                )
              );
              mobileGoal.current[focusedRobot].position.y = newHeight;
            }
          }}
          step={0.01}
        />
      </div>
    </div>
  );
}

function ControlColumn({
  label,
  onChange,
  step,
}: {
  label: string;
  onChange: (delta: number) => void;
  step: number;
}) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPressedRef = useRef(false);

  const stopRepeating = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isPressedRef.current = false;
  }, []);

  const startRepeating = useCallback(
    (delta: number) => {
      // Stop any existing interval first
      stopRepeating();

      isPressedRef.current = true;

      // Immediate first action
      onChange(delta);

      // Then repeat with interval
      intervalRef.current = setInterval(() => {
        onChange(delta);
      }, 50); // Repeat every 50ms
    },
    [onChange, stopRepeating]
  );

  const handleDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      startRepeating(-step);
    },
    [startRepeating, step]
  );

  const handleUp = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      startRepeating(step);
    },
    [startRepeating, step]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const getIcon = () => {
    switch (label) {
      case "Wrist":
        return (
          <svg
            className="w-5 h-5 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
            />
          </svg>
        );
      case "Pitch":
        return (
          <svg
            className="w-5 h-5 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        );
      case "Gripper":
        return (
          <svg
            className="w-5 h-5 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        );
      case "Height":
        return (
          <svg
            className="w-5 h-5 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <button
        onMouseDown={handleUp}
        onMouseUp={stopRepeating}
        onMouseLeave={stopRepeating}
        onTouchStart={handleUp}
        onTouchEnd={stopRepeating}
        className="w-8 h-8 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg flex items-center justify-center transition-colors touch-manipulation"
      >
        <svg
          className="w-4 h-4 text-gray-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 15l7-7 7 7"
          />
        </svg>
      </button>
      <div className="w-7 h-7 flex items-center justify-center">
        {getIcon()}
      </div>
      <button
        onMouseDown={handleDown}
        onMouseUp={stopRepeating}
        onMouseLeave={stopRepeating}
        onTouchStart={handleDown}
        onTouchEnd={stopRepeating}
        className="w-8 h-8 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg flex items-center justify-center transition-colors touch-manipulation"
      >
        <svg
          className="w-4 h-4 text-gray-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
    </div>
  );
}
