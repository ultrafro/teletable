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
    const { hostId, roomId, clientId } = body;

    // Validate required fields
    if (!hostId || !roomId || !clientId) {
      return NextResponse.json(
        { error: "Missing required fields: hostId, roomId, clientId" },
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

    // Check if room exists and user is the host
    const room = await RoomManager.getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.hostId !== hostId) {
      return NextResponse.json(
        { error: "Unauthorized: You are not the host of this room" },
        { status: 403 }
      );
    }

    // Check if the client is actually the current controlling client
    if (room.currentControllingClientId !== clientId) {
      return NextResponse.json(
        { error: "Client is not currently controlling this room" },
        { status: 400 }
      );
    }

    // Revoke control from the client
    const updatedRoom = await RoomManager.revokeClientControl(roomId);
    if (!updatedRoom) {
      return NextResponse.json(
        { error: "Failed to revoke client control" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Client control revoked",
      revokedClient: clientId,
    });
  } catch (error) {
    console.error("Error in revokeClientControl:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
