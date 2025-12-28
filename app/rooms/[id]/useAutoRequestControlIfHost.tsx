import { useEffect, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { RoomData } from "./roomUI.model";

export function useAutoRequestControlIfHost(
  roomData: RoomData,
  user: User | null,
  isInControl: boolean,
  isRequestingControl: boolean,
  handleRequestControl: () => void
) {
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    // Reset the ref if room data changes (e.g., switching rooms)
    hasRequestedRef.current = false;
  }, [roomData.roomId]);

  useEffect(() => {
    // Auto-request control if:
    // 1. User is the host viewing as client
    // 2. User is not already in control
    // 3. Not currently requesting control
    // 4. User ID exists
    // 5. Haven't already requested in this session
    if (
      roomData.isHost &&
      !isInControl &&
      !isRequestingControl &&
      user?.id &&
      !hasRequestedRef.current
    ) {
      console.log(
        "[AUTO] Host viewing as client - auto-requesting control"
      );
      hasRequestedRef.current = true;
      handleRequestControl();
    }
  }, [
    roomData.isHost,
    isInControl,
    isRequestingControl,
    user?.id,
    handleRequestControl,
  ]);
}

