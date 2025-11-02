import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, createAuthError } from "../auth/simple";
import { RoomManager } from "../data/rooms";
import { supabaseAdmin, dbToAppRoom } from "../db/supabase";

export async function GET(request: NextRequest) {
  try {
    // Check authenticity
    const auth = authenticateRequest(request.headers);
    if (!auth.isValid || !auth.userId) {
      return createAuthError();
    }

    const hostId = auth.userId;

    // Fetch all rooms for this host
    const { data, error } = await supabaseAdmin
      .from("rooms")
      .select("*")
      .eq("hostid", hostId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching host rooms:", error);
      return NextResponse.json(
        { error: "Failed to fetch rooms" },
        { status: 500 }
      );
    }

    const rooms = data ? data.map(dbToAppRoom) : [];

    return NextResponse.json({
      success: true,
      rooms: rooms.map((room) => ({
        roomId: room.roomId,
        hostId: room.hostId,
        hostPeerId: room.hostPeerId,
        currentControllingClientId: room.currentControllingClientId,
        created_at: data.find((r) => r.id === room.roomId)?.created_at,
        hasActiveControl: room.currentControllingClientId !== null,
        requestingClientsCount: Object.keys(
          room.info.requestingClientIds || {}
        ).length,
      })),
    });
  } catch (error) {
    console.error("Error in getHostRooms:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

