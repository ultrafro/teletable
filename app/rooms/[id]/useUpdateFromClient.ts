import { UsePeerJSResult } from "@/app/hooks/usePeerJS";
import { DataFrame } from "@/app/teletable.model";
import { DataConnection, MediaConnection } from "peerjs";
import { useEffect } from "react";

export function useUpdateFromClient(
  peerJS: UsePeerJSResult,
  onStateUpdate: (state: Record<string, DataFrame>) => void
) {
  useEffect(() => {
    console.log("peerJS.connections change", peerJS.connections);

    peerJS.connections.forEach((connection) => {
      console.log("adding data listener to connection", connection.peer);
      connection.on("data", (data) => {
        try {
          const state = JSON.parse(data as string);
          onStateUpdate(state);
        } catch (error) {
          console.error("Error parsing data", error, data);
        }
      });
    });

    return () => {
      peerJS.connections.forEach((connection) => {
        console.log("removing data listener from connection", connection.peer);
        connection.off("data");
      });
    };
  }, [peerJS.connections, onStateUpdate]);
}
