import { useEffect, useRef } from "react";
import { RoomData } from "./roomUI.model";
import { UsePeerResult } from "@/app/hooks/usePeer";

export function useAutoApproveRequestWithPassword(roomData: RoomData, handleApproveRequest: (clientId: string) => void) {

    //a use effect that looks at the user request for control, and if it has the room password,
    //it auto approves the request
    useEffect(() => {
        if (
            roomData.info?.requestingClientIds &&
            Object.keys(roomData.info.requestingClientIds).length > 0
        ) {
            for (const clientId in roomData.info.requestingClientIds) {
                const requestPw = roomData.info.requestingClientIds[clientId].pw;
                const roomPw = roomData.roomPW;
                console.log("room data changed", requestPw, roomPw);
                if (
                    roomData.info.requestingClientIds[clientId].pw === roomData.roomPW
                ) {
                    handleApproveRequest(clientId);
                }
            }
        }
    }, [roomData]);
}

export function useUpdateHostPeerIdWhenItChanges(roomData: RoomData, peer: UsePeerResult, handleUpdateHostPeerId: (peerId: string) => void) {
    useEffect(() => {
        const currentHostPeerId = peer.peer?.id;
        if (currentHostPeerId !== roomData.hostPeerId) {
            handleUpdateHostPeerId(currentHostPeerId || "");
        }
    }, [roomData.hostPeerId, peer.peer?.id, handleUpdateHostPeerId]);
}


export function useResetRoomWhenHostDisconnects(roomData: RoomData, peer: UsePeerResult, handleEndStream: () => void) {


    //if the room's hostPeerId does not match the peer's id, reset the room's ready state
    const lastHostPeerId = useRef<string | undefined>(undefined);
    useEffect(() => {
        const currentHostPeerId = peer.peer?.id;

        if (currentHostPeerId !== lastHostPeerId.current) {
            lastHostPeerId.current = currentHostPeerId;
            if (!!roomData.hostPeerId && roomData.hostPeerId !== peer.peer?.id) {
                console.log("ending stream!");
                handleEndStream();
            }
        }
    }, [roomData.hostPeerId, peer.peer?.id, handleEndStream]);
}

export function useMakeRoomReadyOnLoad(roomData: RoomData, handleMakeRoomReady: () => void) {
    useEffect(() => {
        if (roomData.hostPeerId === null) {
            handleMakeRoomReady();
        }
    }, [roomData.hostPeerId, handleMakeRoomReady]);
}