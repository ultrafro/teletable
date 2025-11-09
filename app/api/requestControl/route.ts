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
    const { clientId, roomId, pw } = body;

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

    // Add to requesting client IDs
    const updatedRoom = await RoomManager.addRequestingClient(
      roomId,
      clientId,
      pw
    );
    if (!updatedRoom) {
      return NextResponse.json(
        { error: "Failed to add client to request list" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Control request submitted",
      requestStatus: "pending",
    });
  } catch (error) {
    console.error("Error in requestControl:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
