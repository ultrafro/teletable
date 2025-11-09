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
    const { roomId, hostId } = body;

    // Validate required fields
    if (!roomId || !hostId) {
      return NextResponse.json(
        { error: "Missing required fields: roomId, hostId" },
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

    // Check if room already exists
    const existingRoom = await RoomManager.getRoom(roomId);
    if (existingRoom) {
      return NextResponse.json(
        { error: "Room already exists" },
        { status: 409 }
      );
    }

    // Create new room
    const room = await RoomManager.createOrUpdateRoom(roomId, {
      hostId,
      hostPeerId: null, // Will be set when host is ready
      currentControllingClientId: null,
      info: {
        requestingClientIds: {},
        version: "0",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Room created successfully",
      room: {
        roomId: room.roomId,
        hostId: room.hostId,
        isReady: false,
      },
    });
  } catch (error) {
    console.error("Error in createRoom:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
