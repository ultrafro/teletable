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
    const { hostId, roomId, password } = body;

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

    // Update the room password (password can be empty string to clear it)
    const updatedRoom = await RoomManager.createOrUpdateRoom(roomId, {
      ...room,
      pw: password || undefined,
    });

    if (!updatedRoom) {
      return NextResponse.json(
        { error: "Failed to update room password" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: password ? "Room password updated" : "Room password cleared",
      room: {
        roomId: updatedRoom.roomId,
        roomPW: updatedRoom.pw,
      },
    });
  } catch (error) {
    console.error("Error in updateRoomPassword:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
