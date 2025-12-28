import { useState, useEffect, useCallback } from "react";
import { RoomData } from "./roomUI.model";
import { User, Session } from "@supabase/supabase-js";
import {
  createAuthFetchOptions,
  isUserAuthenticated,
} from "../../lib/authHeaders";

export function useBasicRoomInfo(roomId: string, user: User | null, session: Session | null) {
  //do a fetch to getClientRoomInfo every 3 seconds
  const [roomData, setRoomData] = useState<RoomData | null>(null);

  const fetchRoomData = useCallback(async () => {
    if (!isUserAuthenticated(user)) return;

    try {
      const response = await fetch(
        `/api/getBasicRoomInfo?roomId=${roomId}&userId=${user.id}`,
        createAuthFetchOptions(session, "GET")
      );

      if (!response.ok) {
        if (response.status === 401) {
          console.error("Authentication failed");
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setRoomData(data.roomInfo || data);
    } catch (error) {
      console.error("Error fetching room data:", error);
    }
  }, [user, session, roomId]);

  useEffect(() => {
    // Initial fetch
    fetchRoomData();
  }, [fetchRoomData]);

  useEffect(() => {
    const isHost = roomData?.isHost;
    const interval = setInterval(
      () => {
        fetchRoomData();
      },
      isHost ? 1000 : 3000
    );
    return () => clearInterval(interval);
  }, [fetchRoomData, roomData?.isHost]);

  return { roomData, refetchRoomData: fetchRoomData };
}
