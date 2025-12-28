import { useCallback, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { getAuthHeaders } from "@/app/lib/authHeaders";

export function useControlRequest(
  user: User | null,
  session: Session | null,
  roomId: string | null,
  pw?: string,
  refetchRoomData?: () => void,
  isHost?: boolean
) {
  const [isRequestingControl, setIsRequestingControl] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);

  const handleRequestControl = useCallback(async () => {
    if (!user?.id || !roomId) {
      console.error("Missing user ID or room ID");
      return;
    }

    setIsRequestingControl(true);
    setRequestStatus(null);

    try {
      const response = await fetch("/api/requestControl", {
        method: "POST",
        headers: getAuthHeaders(session),
        body: JSON.stringify({
          clientId: user.id,
          roomId: roomId,
          pw: pw,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.autoApproved) {
          setRequestStatus("Control granted instantly!");
          // Immediately refetch room data to get updated control status
          if (refetchRoomData) {
            refetchRoomData();
          }
        } else {
          setRequestStatus("Request sent successfully!");
        }
      } else {
        setRequestStatus(data.error || "Failed to send request");
      }
    } catch (error) {
      console.error("Error requesting control:", error);
      setRequestStatus("Network error occurred");
    } finally {
      setIsRequestingControl(false);
    }
  }, [user, session, roomId, pw, refetchRoomData]);

  return {
    handleRequestControl,
    isRequestingControl,
    requestStatus,
  };
}
