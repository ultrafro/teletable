// Supabase-based data store for rooms
import {
  supabaseAdmin,
  dbToAppRoom,
  appToDbRoom,
  Room,
  RoomInfo,
} from "../db/supabase";

const currentRoomInfoVersion = "0";

// Re-export types for backward compatibility
export type { Room, RoomInfo };

export class RoomManager {
  static async getRoom(roomId: string): Promise<Room | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No rows returned
          return null;
        }
        console.error("Error fetching room:", error);
        throw error;
      }

      return data ? dbToAppRoom(data) : null;
    } catch (error) {
      console.error("Error in getRoom:", error);
      throw error;
    }
  }

  static async createOrUpdateRoom(
    roomId: string,
    updates: Partial<Room>
  ): Promise<Room> {
    try {
      // First, try to get the existing room
      const existingRoom = await this.getRoom(roomId);

      // Merge with existing data
      const roomData: Room = {
        roomId,
        hostId: updates.hostId || existingRoom?.hostId || "",
        hostPeerId:
          updates.hostPeerId !== undefined
            ? updates.hostPeerId
            : existingRoom?.hostPeerId || null,
        currentControllingClientId:
          updates.currentControllingClientId !== undefined
            ? updates.currentControllingClientId
            : existingRoom?.currentControllingClientId || null,
        pw: updates.pw !== undefined ? updates.pw : existingRoom?.pw || null,
        info: updates.info ||
          existingRoom?.info || {
            requestingClientIds: {},
            version: currentRoomInfoVersion,
          },
      };

      // Convert to database format
      const dbData = appToDbRoom(roomData);

      // Upsert the room
      const { data, error } = await supabaseAdmin
        .from("rooms")
        .upsert(dbData, { onConflict: "id" })
        .select()
        .single();

      if (error) {
        console.error("Error upserting room:", error);
        throw error;
      }

      return dbToAppRoom(data);
    } catch (error) {
      console.error("Error in createOrUpdateRoom:", error);
      throw error;
    }
  }

  static async addRequestingClient(
    roomId: string,
    clientId: string,
    pw?: string
  ): Promise<Room | null> {
    try {
      const room = await this.getRoom(roomId);
      if (!room) return null;

      // Add the client to the requesting list if not already present
      if (!room.info.requestingClientIds[clientId]) {
        room.info.requestingClientIds[clientId] = {
          clientId,
          requestTime: Date.now(),
          pw: pw,
        };
      }

      // Update the room in the database
      const updatedRoom = await this.createOrUpdateRoom(roomId, room);
      return updatedRoom;
    } catch (error) {
      console.error("Error in addRequestingClient:", error);
      throw error;
    }
  }

  static async setControllingClient(
    roomId: string,
    clientId: string
  ): Promise<Room | null> {
    try {
      const room = await this.getRoom(roomId);
      if (!room) return null;

      // Set the controlling client
      room.currentControllingClientId = clientId;

      // Remove from requesting list
      room.info.requestingClientIds = Object.fromEntries(
        Object.values(room.info.requestingClientIds)
          .filter((req) => req.clientId !== clientId)
          .map((req) => [req.clientId, req])
      );

      // Update the room in the database
      const updatedRoom = await this.createOrUpdateRoom(roomId, room);
      return updatedRoom;
    } catch (error) {
      console.error("Error in setControllingClient:", error);
      throw error;
    }
  }

  static async removeRequestingClient(
    roomId: string,
    clientId: string
  ): Promise<Room | null> {
    try {
      const room = await this.getRoom(roomId);
      if (!room) return null;

      // Remove the client from the requesting list
      room.info.requestingClientIds = Object.fromEntries(
        Object.values(room.info.requestingClientIds)
          .filter((req) => req.clientId !== clientId)
          .map((req) => [req.clientId, req])
      );

      // Update the room in the database
      const updatedRoom = await this.createOrUpdateRoom(roomId, room);
      return updatedRoom;
    } catch (error) {
      console.error("Error in removeRequestingClient:", error);
      throw error;
    }
  }

  static async revokeClientControl(roomId: string): Promise<Room | null> {
    try {
      const room = await this.getRoom(roomId);
      if (!room) return null;

      // Clear the current controlling client
      room.currentControllingClientId = null;

      // Update the room in the database
      const updatedRoom = await this.createOrUpdateRoom(roomId, room);
      return updatedRoom;
    } catch (error) {
      console.error("Error in revokeClientControl:", error);
      throw error;
    }
  }

  static async getAllRooms(): Promise<Room[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from("rooms")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching all rooms:", error);
        throw error;
      }

      return data ? data.map(dbToAppRoom) : [];
    } catch (error) {
      console.error("Error in getAllRooms:", error);
      throw error;
    }
  }

  static async deleteRoom(roomId: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from("rooms")
        .delete()
        .eq("id", roomId);

      if (error) {
        console.error("Error deleting room:", error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error("Error in deleteRoom:", error);
      return false;
    }
  }
}
