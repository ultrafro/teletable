"use client";

import { useParams } from "next/navigation";
import { useAuth } from "@/app/lib/auth";
import ClientView from "@/app/rooms/[id]/ClientView";
import { useBasicRoomInfo } from "@/app/rooms/[id]/useBasicRoomInfo";
import { useSignInAnonymouslyWhenRoomLoads } from "@/app/rooms/[id]/useSignInAnonymouslyWhenRoomLoads";

export default function ClientRoomPage() {
    const { roomId } = useParams();
    const { user, session, loading: authLoading } = useAuth();

    useSignInAnonymouslyWhenRoomLoads();

    const { roomData: basicRoomInfo, refetchRoomData } = useBasicRoomInfo(roomId as string, user, session);

    if (authLoading || !basicRoomInfo) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
                    <p className="text-foreground text-lg">Loading Room...</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="h-screen bg-background text-foreground flex flex-col overflow-hidden"
            style={{ height: "100dvh" }}
        >
            <div className="flex-1 min-h-0">
                <ClientView
                    roomData={basicRoomInfo}
                    user={user}
                    session={session}
                    refetchRoomData={refetchRoomData}
                />
            </div>
        </div>
    );
}

