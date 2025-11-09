import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, createAuthError } from "../auth/simple";
import { RoomManager } from "../data/rooms";
import { RoomData } from "@/app/rooms/[id]/roomUI.model";

export async function GET(request: NextRequest) {
  try {
    // Check authenticity
    const auth = await authenticateRequest(request.headers);
    if (!auth.isValid || !auth.userId) {
      return createAuthError();
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const roomId = searchParams.get("roomId");

    // Validate required fields
    if (!userId || !roomId) {
      return NextResponse.json(
        { error: "Missing required fields: clientId, roomId" },
        { status: 400 }
      );
    }

    // Verify that the authenticated user matches the clientId
    if (auth.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized: clientId does not match authenticated user" },
        { status: 403 }
      );
    }

    // Check if room exists
    const room = await RoomManager.getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Check if the client is the current controlling client (approved)
    const isApprovedClient = room.currentControllingClientId === userId;

    const isHost = room.hostId === userId;

    // Return room info and conditionally include host peer ID
    const roomInfo: RoomData = {
      roomId: room.roomId,
      isHost: isHost,
      hostPeerId: isHost || isApprovedClient ? room.hostPeerId : null,
      currentControllingClientId: room.currentControllingClientId,
      info: room.info,
      roomPW: isHost ? room.pw || "" : "",
    };

    return NextResponse.json({
      success: true,
      roomInfo,
      hostPeerId: isApprovedClient ? room.hostPeerId : null,
    });
  } catch (error) {
    console.error("Error in getClientRoomInfo:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
