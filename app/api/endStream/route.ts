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
    const { hostId, roomId } = body;

    // Validate required fields
    if (!hostId || !roomId) {
      return NextResponse.json(
        { error: "Missing required fields: hostId, roomId" },
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

    // Check if room exists
    const room = await RoomManager.getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Verify that the user is actually the host of this room
    if (room.hostId !== hostId) {
      return NextResponse.json(
        { error: "Unauthorized: You are not the host of this room" },
        { status: 403 }
      );
    }

    // Clear the hostPeerId and reset control state
    const updatedRoom = await RoomManager.createOrUpdateRoom(roomId, {
      hostId,
      hostPeerId: null, // Clear the peer ID
      currentControllingClientId: null, // Clear any current controlling client
      info: {
        requestingClientIds: {}, // Clear all pending requests
        version: (parseInt(room.info.version || "0") + 1).toString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Stream ended successfully",
      room: {
        roomId: updatedRoom.roomId,
        hostId: updatedRoom.hostId,
        isReady: false,
      },
    });
  } catch (error) {
    console.error("Error in endStream:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
