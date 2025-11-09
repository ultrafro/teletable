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
      console.log("establishing data connection to host:", hostPeerId);
      if (!peer.peer || !peer.isConnected || !hostPeerId) {
        console.log(
          "not establishing data connection to host because of missing requirements:",
          {
            peer: !!peer.peer,
            isConnected: peer.isConnected,
            hostPeerId: !!hostPeerId,
          }
        );
        return;
      }
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
      console.log("Data connection established to host:", dataConnection.peer);
    };
    establishDataConnection();

    return () => {
      console.log("closing data connection");
      if (dataConnection) {
        dataConnection.close();
      }
    };
  }, [hostPeerId, peer]);

  return dataConnection;
}
