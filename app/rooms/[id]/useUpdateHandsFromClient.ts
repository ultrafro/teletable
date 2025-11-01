import { UsePeerJSResult } from "@/app/hooks/usePeerJS";
import { BothHands, DataFrame } from "@/app/teletable.model";
import { useEffect } from "react";

export function useUpdateHandsFromClientData(
  currentHands: Record<string, DataFrame>,
  peerJS: UsePeerJSResult,
  onHandsUpdate?: (hands: Record<string, DataFrame>) => void
) {
  useEffect(() => {
    peerJS.connections.forEach((connection) => {
      connection.on("data", (data) => {
        try {
          const newHands = JSON.parse(data as string);
          let handsUpdated = false;

          for (const key in newHands?.currentHands) {
            currentHands[key as keyof BothHands] =
              newHands?.currentHands[key as keyof BothHands];
            handsUpdated = true;
          }

          // Notify about hands update if callback provided
          if (handsUpdated && onHandsUpdate) {
            onHandsUpdate(currentHands);
          }
        } catch (error) {
          console.error("Error parsing data", error, data);
        }
      });
    });
  }, [peerJS, onHandsUpdate]);
}
