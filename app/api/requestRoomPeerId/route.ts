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
    const { clientId, roomId } = body;

    // Validate required fields
    if (!clientId || !roomId) {
      return NextResponse.json(
        { error: "Missing required fields: clientId, roomId" },
        { status: 400 }
      );
    }

    // Verify that the authenticated user matches the clientId
    if (auth.userId !== clientId) {
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

    // Check if clientId matches currentControllingId
    if (room.currentControllingClientId !== clientId) {
      return NextResponse.json(
        { error: "You are not currently controlling this room" },
        { status: 403 }
      );
    }

    // Return the hostPeerId
    return NextResponse.json({
      success: true,
      hostPeerId: room.hostPeerId,
      roomId: room.roomId,
    });
  } catch (error) {
    console.error("Error in requestRoomPeerId:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
