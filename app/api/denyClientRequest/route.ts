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

    // Check if the client actually requested control
    if (!room.info.requestingClientIds[clientId]) {
      return NextResponse.json(
        { error: "Client has not requested control for this room" },
        { status: 400 }
      );
    }

    // Remove the client from the requesting list
    const updatedRoom = await RoomManager.removeRequestingClient(
      roomId,
      clientId
    );
    if (!updatedRoom) {
      return NextResponse.json(
        { error: "Failed to deny client request" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Client request denied",
      deniedClient: clientId,
    });
  } catch (error) {
    console.error("Error in denyClientRequest:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
