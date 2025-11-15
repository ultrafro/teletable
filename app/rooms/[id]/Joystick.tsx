import { ExternalGoal } from "@/app/teletable.model";
import {
  useRef,
  useState,
  useCallback,
  useEffect,
  MutableRefObject,
} from "react";

export function Joystick({
  onChange,
  speed,
}: {
  onChange: (deltaX: number, deltaY: number) => void;
  speed: number;
}) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const nippleRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const continuousUpdateRef = useRef<number | null>(null);
  const centerRef = useRef({ x: 0, y: 0 });
  const velocityRef = useRef({ x: 0, z: 0 });
  const lastUpdateTimeRef = useRef<number | null>(null);

  const updatePosition = useCallback((deltaX: number, deltaY: number) => {
    if (!nippleRef.current) return;

    const maxDistance = 30; // Maximum distance from center
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    let constrainedX = deltaX;
    let constrainedY = deltaY;

    if (distance > maxDistance) {
      const angle = Math.atan2(deltaY, deltaX);
      constrainedX = Math.cos(angle) * maxDistance;
      constrainedY = Math.sin(angle) * maxDistance;
    }

    // Direct DOM manipulation for smooth updates
    nippleRef.current.style.transform = `translate(${constrainedX}px, ${constrainedY}px)`;

    // Normalize to -1 to 1 range and store as velocity
    const normalizedX = constrainedX / maxDistance;
    const normalizedY = -constrainedY / maxDistance; // Invert Y for intuitive up/down

    // Store velocity for continuous relative updates
    velocityRef.current.x = normalizedX;
    velocityRef.current.z = normalizedY;
  }, []);

  const handleStart = useCallback(
    (clientX: number, clientY: number) => {
      if (!joystickRef.current || !nippleRef.current) return;
      setIsDragging(true);
      isDraggingRef.current = true;
      const rect = joystickRef.current.getBoundingClientRect();
      centerRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      // Remove transition during dragging for smooth movement
      nippleRef.current.style.transition = "none";
      updatePosition(
        clientX - centerRef.current.x,
        clientY - centerRef.current.y
      );
    },
    [updatePosition]
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging) return;

      // Use requestAnimationFrame for smooth updates
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        updatePosition(
          clientX - centerRef.current.x,
          clientY - centerRef.current.y
        );
      });
    },
    [isDragging, updatePosition]
  );

  const handleEnd = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (continuousUpdateRef.current !== null) {
      cancelAnimationFrame(continuousUpdateRef.current);
      continuousUpdateRef.current = null;
    }
    setIsDragging(false);
    isDraggingRef.current = false;
    lastUpdateTimeRef.current = null;
    if (nippleRef.current) {
      // Restore transition for smooth return to center
      nippleRef.current.style.transition = "transform 0.2s ease-out";
      nippleRef.current.style.transform = "translate(0px, 0px)";
    }
    // Stop movement by resetting velocity
    velocityRef.current.x = 0;
    velocityRef.current.z = 0;
  }, []);

  // Continuous update loop for relative position changes
  useEffect(() => {
    if (!isDragging) {
      lastUpdateTimeRef.current = null;
      return;
    }

    const updateLoop = (currentTime: number) => {
      if (!isDraggingRef.current) {
        lastUpdateTimeRef.current = null;
        return;
      }

      const deltaTime = lastUpdateTimeRef.current
        ? (currentTime - lastUpdateTimeRef.current) / 1000 // Convert to seconds
        : 0.016; // Default to ~60fps on first frame

      // Apply velocity to position (relative/incremental control)
      onChange(
        velocityRef.current.x * speed * deltaTime * 60,
        velocityRef.current.z * speed * deltaTime * 60
      );

      lastUpdateTimeRef.current = currentTime;
      continuousUpdateRef.current = requestAnimationFrame(updateLoop);
    };

    continuousUpdateRef.current = requestAnimationFrame(updateLoop);

    return () => {
      if (continuousUpdateRef.current !== null) {
        cancelAnimationFrame(continuousUpdateRef.current);
        continuousUpdateRef.current = null;
      }
      lastUpdateTimeRef.current = null;
    };
  }, [isDragging, onChange]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      handleEnd();
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches[0]) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleTouchEnd = () => {
      handleEnd();
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove, { passive: true });
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, handleMove, handleEnd]);

  return (
    <div
      ref={joystickRef}
      className="relative w-16 h-16 bg-gray-100 rounded-full border-2 border-gray-300 flex items-center justify-center touch-none"
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onTouchStart={(e) => {
        e.preventDefault();
        if (e.touches[0]) {
          handleStart(e.touches[0].clientX, e.touches[0].clientY);
        }
      }}
    >
      {/* Joystick nipple */}
      <div
        ref={nippleRef}
        className="absolute w-8 h-8 bg-gray-400 rounded-full shadow-lg will-change-transform"
        style={{
          transform: "translate(0px, 0px)",
        }}
      />
    </div>
  );
}
