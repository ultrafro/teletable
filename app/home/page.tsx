"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { nanoid } from "nanoid";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();
  const { user, session, loading, signOut } = useAuth();
  const [rooms, setRooms] = useState<any[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [roomCreating, setRoomCreating] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  const fetchRooms = async () => {
    if (!user) return;

    setRoomsLoading(true);
    setRoomsError(null);

    try {
      const response = await fetch("/api/getHostRooms", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
      });

      const result = await response.json();

      if (response.ok) {
        setRooms(result.rooms || []);
      } else {
        setRoomsError(result.error || "Failed to fetch rooms");
      }
    } catch (error) {
      setRoomsError("Network error occurred");
    }

    setRoomsLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchRooms();
    }
  }, [user]);

  const handleCreateRoom = async () => {
    if (!user || !session) return;

    setRoomCreating(true);
    setRoomError(null);

    const roomId = `room-${nanoid(8)}`;

    try {
      const response = await fetch("/api/createRoom", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          roomId,
          hostId: user.id,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        fetchRooms();
        router.push(`/host/${roomId}`);
      } else {
        setRoomError(result.error || "Failed to create room");
      }
    } catch (error) {
      setRoomError("Network error occurred");
    }

    setRoomCreating(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div>
      </div>
    );
  }

  if (!user) {
    router.push("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="w-full px-6 py-4 border-b border-foreground/10 flex justify-between items-center">
        <Link href="/home" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Teletable
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-foreground/70">{user.email}</span>
          <button
            onClick={signOut}
            className="px-4 py-2 text-sm text-foreground/70 hover:text-foreground transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Your Rooms</h1>
          <p className="text-foreground/70">
            Create and manage your robot arm control rooms
          </p>
        </div>

        {/* Create Room Section */}
        <div className="bg-foreground/5 rounded-xl p-6 mb-8 border border-foreground/10">
          <h2 className="text-xl font-semibold mb-4">Create New Room</h2>
          <p className="text-foreground/70 mb-6">
            Create a new room to start hosting robot arm control sessions. You'll
            automatically become the host.
          </p>

          {roomError && (
            <div className="text-red-600 text-sm mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
              {roomError}
            </div>
          )}

          <button
            onClick={handleCreateRoom}
            disabled={roomCreating}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {roomCreating ? (
              <>
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Creating Room...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create New Room
              </>
            )}
          </button>
        </div>

        {/* Rooms List */}
        <div className="bg-foreground/5 rounded-xl p-6 border border-foreground/10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Your Rooms</h2>
            <button
              onClick={fetchRooms}
              disabled={roomsLoading}
              className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg
                className={`w-4 h-4 ${roomsLoading ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {roomsLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {roomsLoading && (
            <div className="text-center py-12 text-foreground/50">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto mb-4"></div>
              Loading rooms...
            </div>
          )}

          {roomsError && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              {roomsError}
            </div>
          )}

          {!roomsLoading && !roomsError && rooms.length === 0 && (
            <div className="text-center py-12 text-foreground/50">
              <p className="text-lg mb-2">You haven't created any rooms yet.</p>
              <p className="text-sm">
                Create your first room using the button above!
              </p>
            </div>
          )}

          {!roomsLoading && rooms.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <Link
                  key={room.roomId}
                  href={`/host/${room.roomId}`}
                  className="border border-foreground/10 rounded-lg p-4 hover:shadow-lg hover:border-blue-500 transition-all bg-background"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold truncate">
                      {room.roomId}
                    </h3>
                    <span
                      className={`ml-2 px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                        room.hasActiveControl
                          ? "bg-yellow-100 text-yellow-800"
                          : room.hostPeerId
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {room.hasActiveControl
                        ? "Active Control"
                        : room.hostPeerId
                        ? "Ready"
                        : "Not Ready"}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm text-foreground/70">
                    {room.created_at && (
                      <p>
                        <span className="font-medium">Created:</span>{" "}
                        {new Date(room.created_at).toLocaleDateString()}{" "}
                        {new Date(room.created_at).toLocaleTimeString()}
                      </p>
                    )}
                    <p>
                      <span className="font-medium">Status:</span>{" "}
                      {room.hostPeerId
                        ? "Host connected"
                        : "Host not connected"}
                    </p>
                    {room.currentControllingClientId && (
                      <p>
                        <span className="font-medium">Controlled by:</span>{" "}
                        <span className="text-blue-600">
                          {room.currentControllingClientId.slice(0, 8)}...
                        </span>
                      </p>
                    )}
                    {room.requestingClientsCount > 0 && (
                      <p>
                        <span className="font-medium">Pending requests:</span>{" "}
                        <span className="text-orange-600">
                          {room.requestingClientsCount}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-foreground/10">
                    <p className="text-xs text-blue-600">Click to open →</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


