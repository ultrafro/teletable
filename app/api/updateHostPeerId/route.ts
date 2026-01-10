import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, createAuthError } from "../auth/simple";
import { RoomManager } from "../data/rooms";

export async function POST(request: NextRequest) {
  try {
    // Check authenticity
    const auth = await authenticateRequest(request.headers);
    if (!auth.isValid || !auth.userId) {
      return createAuthError();
    }

    const body = await request.json();
    const { hostId, roomId, newHostPeerId } = body;

    // Validate required fields
    if (!hostId || !roomId || !newHostPeerId) {
      return NextResponse.json(
        { error: "Missing required fields: hostId, roomId, newHostPeerId" },
        { status: 400 }
      );
    }

    // Verify that the authenticated user matches the hostId
    if (auth.userId !== hostId) {
      return NextResponse.json(
        { error: "Unauthorized: hostId does not match authenticated user" },
        { status: 403 }
      );
    }

    // Verify the room exists and belongs to this host
    const existingRoom = await RoomManager.getRoom(roomId);
    if (!existingRoom) {
      return NextResponse.json(
        { error: "Room not found" },
        { status: 404 }
      );
    }

    if (existingRoom.hostId !== hostId) {
      return NextResponse.json(
        { error: "Unauthorized: you are not the host of this room" },
        { status: 403 }
      );
    }

    // Update room with new host peer ID
    const room = await RoomManager.createOrUpdateRoom(roomId, {
      hostPeerId: newHostPeerId,
    });

    return NextResponse.json({
      success: true,
      room: {
        roomId: room.roomId,
        hostId: room.hostId,
        hostPeerId: room.hostPeerId,
      },
    });
  } catch (error) {
    console.error("Error in updateHostPeerId:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
