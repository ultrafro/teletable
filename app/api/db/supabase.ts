import { createClient } from "@supabase/supabase-js";

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
}

// Create Supabase client with service role key for admin operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Database types based on our schema
export interface DatabaseRoom {
  id: string; // UUID
  created_at: string; // timestamp
  hostid: string;
  hostpeerid: string | null;
  currentcontrollingclientid: string | null;
  info: Record<string, any>; // JSON field
}

// Application types (matching the original interface)
export interface Room {
  roomId: string;
  hostId: string;
  hostPeerId: string | null;
  currentControllingClientId: string | null;
  info: RoomInfo;
}

export type RoomInfo = {
  requestingClientIds: Record<
    string,
    {
      clientId: string;
      requestTime: number;
      pw?: string;
    }
  >;
  version: "0";
};

// Helper functions to convert between database and application formats
export function dbToAppRoom(dbRoom: DatabaseRoom): Room {
  return {
    roomId: dbRoom.id,
    hostId: dbRoom.hostid,
    hostPeerId: dbRoom.hostpeerid,
    currentControllingClientId: dbRoom.currentcontrollingclientid,
    info: dbRoom.info as RoomInfo,
  };
}

export function appToDbRoom(room: Partial<Room>): Partial<DatabaseRoom> {
  const dbRoom: Partial<DatabaseRoom> = {};

  if (room.roomId) dbRoom.id = room.roomId;
  if (room.hostId) dbRoom.hostid = room.hostId;
  if (room.hostPeerId !== undefined) dbRoom.hostpeerid = room.hostPeerId;
  if (room.currentControllingClientId !== undefined) {
    dbRoom.currentcontrollingclientid = room.currentControllingClientId;
  }
  if (room.info) {
    dbRoom.info = room.info;
  }

  return dbRoom;
}
