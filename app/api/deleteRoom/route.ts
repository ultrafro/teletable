import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, createAuthError } from "../auth/simple";
import { RoomManager } from "../data/rooms";

export async function DELETE(request: NextRequest) {
  try {
    // Check authenticity
    const auth = await authenticateRequest(request.headers);
    if (!auth.isValid || !auth.userId) {
      return createAuthError();
    }

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");

    // Validate required fields
    if (!roomId) {
      return NextResponse.json(
        { error: "Missing required field: roomId" },
        { status: 400 }
      );
    }

    // Get the room to verify ownership
    const room = await RoomManager.getRoom(roomId);
    if (!room) {
      return NextResponse.json(
        { error: "Room not found" },
        { status: 404 }
      );
    }

    // Verify that the authenticated user is the host
    if (auth.userId !== room.hostId) {
      return NextResponse.json(
        { error: "Unauthorized: only the host can delete this room" },
        { status: 403 }
      );
    }

    // Delete the room
    const success = await RoomManager.deleteRoom(roomId);

    if (success) {
      return NextResponse.json({
        success: true,
        message: "Room deleted successfully",
      });
    } else {
      return NextResponse.json(
        { error: "Failed to delete room" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in deleteRoom:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
