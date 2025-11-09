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
    const { hostId, roomId, peerId } = body;

    // Validate required fields
    if (!hostId || !roomId || !peerId) {
      return NextResponse.json(
        { error: "Missing required fields: hostId, roomId, peerId" },
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

    // Create or update room
    const room = await RoomManager.createOrUpdateRoom(roomId, {
      hostId,
      hostPeerId: peerId,
      currentControllingClientId: null,
      info: {
        requestingClientIds: {},
        version: "0",
      },
    });

    return NextResponse.json({
      success: true,
      room: {
        roomId: room.roomId,
        hostId: room.hostId,
        isReady: true,
      },
    });
  } catch (error) {
    console.error("Error in hostIsReadyForControl:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
