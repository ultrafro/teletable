import { UsePeerJSResult } from "@/app/hooks/usePeerJS";
import { BothHands } from "@/app/teletable.model";
import { useEffect } from "react";

export function useUpdateHandsFromClientData(
  currentHands: BothHands,
  peerJS: UsePeerJSResult
) {
  useEffect(() => {
    peerJS.connections.forEach((connection) => {
      connection.on("data", (data) => {
        try {
          const newHands = JSON.parse(data as string);
          for (const key in newHands?.currentHands) {
            currentHands[key as keyof BothHands] =
              newHands?.currentHands[key as keyof BothHands];
          }
        } catch (error) {
          console.error("Error parsing data", error, data);
        }
      });
    });
  }, [peerJS]);
}
