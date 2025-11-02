"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { useAuth } from "../lib/auth";

export default function HostPage() {
  const router = useRouter();
  const { user, session, loading, signIn, signUp, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Room creation state
  const [roomCreating, setRoomCreating] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [createdRoom, setCreatedRoom] = useState<any>(null);

  // Rooms list state
  const [rooms, setRooms] = useState<any[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const { error } = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password);

    if (error) {
      setAuthError(error.message);
    }
    setAuthLoading(false);
  };

  const fetchRooms = async () => {
    if (!user) return;

    setRoomsLoading(true);
    setRoomsError(null);

    try {
      const response = await fetch("/api/getHostRooms", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${user.id}`,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleCreateRoom = async () => {
    if (!user || !session) return;

    setRoomCreating(true);
    setRoomError(null);

    // Generate a unique room ID using nanoid
    const roomId = `room-${nanoid(8)}`;

    try {
      const response = await fetch("/api/createRoom", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.id}`,
        },
        body: JSON.stringify({
          roomId,
          hostId: user.id,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setCreatedRoom(result.room);
        // Refresh rooms list
        fetchRooms();
        // Redirect to the room page
        router.push(`/rooms/${roomId}`);
      } else {
        setRoomError(result.error || "Failed to create room");
      }
    } catch (error) {
      setRoomError("Network error occurred");
    }

    setRoomCreating(false);
  };

  const handleRoomClick = (roomId: string) => {
    router.push(`/rooms/${roomId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              {isSignUp ? "Create Account" : "Sign in to Host"}
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {isSignUp
                ? "Sign up to create and host rooms"
                : "Sign in to create and manage your rooms"}
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleAuth}>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Enter your email"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {authError && (
              <div className="text-red-600 text-sm text-center">
                {authError}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={authLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {authLoading ? "Loading..." : isSignUp ? "Sign up" : "Sign in"}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-indigo-600 hover:text-indigo-500 text-sm"
              >
                {isSignUp
                  ? "Already have an account? Sign in"
                  : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">
            Host Dashboard
          </h1>
          <p className="mt-2 text-gray-600">
            Welcome, {user.email}! Create and manage your rooms.
          </p>
          <button
            onClick={signOut}
            className="mt-4 text-sm text-indigo-600 hover:text-indigo-500"
          >
            Sign out
          </button>
        </div>

        {/* Create Room Section */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Create New Room
          </h2>
          <p className="text-gray-600 mb-6">
            Click the button below to create a new room with a randomly
            generated ID. You'll automatically become the host.
          </p>

          {roomError && (
            <div className="text-red-600 text-sm mb-4">{roomError}</div>
          )}

          <button
            onClick={handleCreateRoom}
            disabled={roomCreating}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {roomCreating ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
              "🚀 Create New Room"
            )}
          </button>
        </div>

        {/* Existing Rooms Section */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Your Rooms
            </h2>
            <button
              onClick={fetchRooms}
              disabled={roomsLoading}
              className="text-sm text-indigo-600 hover:text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh rooms list"
            >
              {roomsLoading ? "Refreshing..." : "🔄 Refresh"}
            </button>
          </div>

          {roomsLoading && (
            <div className="text-center py-8 text-gray-500">
              Loading rooms...
            </div>
          )}

          {roomsError && (
            <div className="text-red-600 text-sm mb-4">{roomsError}</div>
          )}

          {!roomsLoading && !roomsError && rooms.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>You haven't created any rooms yet.</p>
              <p className="text-sm mt-2">
                Create your first room using the button above!
              </p>
            </div>
          )}

          {!roomsLoading && rooms.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {rooms.map((room) => (
                <div
                  key={room.roomId}
                  onClick={() => handleRoomClick(room.roomId)}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {room.roomId}
                    </h3>
                    <span
                      className={`ml-2 px-2 py-1 text-xs rounded-full ${
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

                  <div className="space-y-1 text-sm text-gray-600">
                    {room.created_at && (
                      <p>
                        <span className="font-medium">Created:</span>{" "}
                        {new Date(room.created_at).toLocaleDateString()}{" "}
                        {new Date(room.created_at).toLocaleTimeString()}
                      </p>
                    )}
                    <p>
                      <span className="font-medium">Status:</span>{" "}
                      {room.hostPeerId ? "Host connected" : "Host not connected"}
                    </p>
                    {room.currentControllingClientId && (
                      <p>
                        <span className="font-medium">Controlled by:</span>{" "}
                        <span className="text-indigo-600">
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

                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <p className="text-xs text-indigo-600 hover:text-indigo-700">
                      Click to open →
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Created Room Display */}
        {createdRoom && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-800 mb-2">
              Room Created Successfully!
            </h3>
            <div className="space-y-2 text-sm text-green-700">
              <p>
                <span className="font-medium">Room ID:</span>{" "}
                {createdRoom.roomId}
              </p>
              <p>
                <span className="font-medium">Host ID:</span>{" "}
                {createdRoom.hostId}
              </p>
              <p>
                <span className="font-medium">Status:</span>{" "}
                {createdRoom.isReady ? "Ready" : "Not Ready"}
              </p>
            </div>
            <div className="mt-4">
              <p className="text-sm text-green-600">
                Share the Room ID{" "}
                <code className="bg-green-100 px-1 rounded">
                  {createdRoom.roomId}
                </code>{" "}
                with clients who want to request control.
              </p>
            </div>
          </div>
        )}

        {/* User Info */}
        <div className="bg-white shadow rounded-lg p-6 mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Your Account
          </h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              <span className="font-medium">Email:</span> {user.email}
            </p>
            <p>
              <span className="font-medium">User ID:</span> {user.id}
            </p>
            <p>
              <span className="font-medium">Last sign in:</span>{" "}
              {user.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleString()
                : "Never"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
