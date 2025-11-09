import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, createAuthError } from "../auth/simple";
import { RoomManager } from "../data/rooms";

export async function GET(request: NextRequest) {
  try {
    // Check authenticity
    const auth = await authenticateRequest(request.headers);
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");

    if (roomId) {
      // Get specific room
      const room = await RoomManager.getRoom(roomId);
      if (!room) {
        return NextResponse.json({ error: "Room not found" }, { status: 404 });
      }

      // For anonymous users (viewing only), provide basic room info
      if (!auth.isValid || !auth.userId) {
        return NextResponse.json({
          success: true,
          room: {
            roomId: room.roomId,
            hostId: room.hostId,
            hasHostPeerId: !!room.hostPeerId,
            currentControllingClientId: room.currentControllingClientId,
            requestingClientIds: [], // Hide specific requesting clients for anonymous users
            isReady: !!room.hostPeerId,
          },
          isAnonymous: true,
        });
      }

      // For authenticated users, provide full room info
      return NextResponse.json({
        success: true,
        room: {
          roomId: room.roomId,
          hostId: room.hostId,
          hasHostPeerId: !!room.hostPeerId,
          currentControllingClientId: room.currentControllingClientId,
          requestingClientIds: Object.keys(room.info.requestingClientIds),
          isReady: !!room.hostPeerId,
        },
        isAnonymous: false,
      });
    } else {
      // Get all rooms (for debugging) - require authentication
      if (!auth.isValid || !auth.userId) {
        return createAuthError();
      }

      const allRooms = await RoomManager.getAllRooms();
      const roomsList = allRooms.map((room) => ({
        roomId: room.roomId,
        hostId: room.hostId,
        hasHostPeerId: !!room.hostPeerId,
        currentControllingClientId: room.currentControllingClientId,
        requestingClientIds: Object.keys(room.info.requestingClientIds),
        isReady: !!room.hostPeerId,
      }));

      return NextResponse.json({
        success: true,
        rooms: roomsList,
        count: roomsList.length,
      });
    }
  } catch (error) {
    console.error("Error in getRoomStatus:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
