import { UsePeerResult } from "@/app/hooks/usePeer";
import { DataConnection, MediaConnection } from "peerjs";
import { useEffect, useState } from "react";

export function useDataConnectionClientside(
  hostPeerId: string,
  peer: UsePeerResult
) {
  const [dataConnection, setDataConnection] = useState<DataConnection | null>(
    null
  );
  useEffect(() => {
    const establishDataConnection = async () => {
      if (!peer.peer) {
        return;
      }
      if (hostPeerId) {
        console.log("Establishing data connection to host:", hostPeerId);

        const dataConnection = await peer.peer?.connect(hostPeerId);
        if (!dataConnection) {
          console.error(
            "Failed to establish data connection to host:",
            hostPeerId
          );
          return;
        }
        setDataConnection(dataConnection);
        console.log(
          "Data connection established to host:",
          dataConnection.peer
        );
      }
    };
    establishDataConnection();
  }, [hostPeerId, peer]);

  return dataConnection;
}
