import { RoomInfo } from "@/app/api/data/rooms";

export interface RoomData {
  roomId: string;
  isHost: boolean;
  hostPeerId: string | null;
  currentControllingClientId: string | null;
  info?: RoomInfo;
  roomPW?: string;
}

export interface RoomResponse {
  success: boolean;
  room: RoomData;
  isAnonymous?: boolean;
  error?: string;
}

export interface ClientRoomInfo {
  roomId: string;
  hostId: string;
  isReady: boolean;
  currentControllingClientId: string | null;
  isController: boolean;
  requestingClientIds: string[];
  hasRequested: boolean;
}

export interface ClientRoomInfoResponse {
  success: boolean;
  roomInfo: ClientRoomInfo;
  hostPeerId: string | null;
  error?: string;
}
