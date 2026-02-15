"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/app/lib/auth";
import ClientView from "@/app/rooms/[id]/ClientView";
import { useBasicRoomInfo } from "@/app/rooms/[id]/useBasicRoomInfo";

export default function ClientRoomPage() {
    const { roomId } = useParams();
    const router = useRouter();
    const { user, session, loading: authLoading } = useAuth();

    const isAnonymousUser =
        !!(user as any)?.is_anonymous ||
        user?.app_metadata?.provider === "anonymous";
    const canAccessClientView = !!user && !isAnonymousUser;

    const { roomData: basicRoomInfo, refetchRoomData } = useBasicRoomInfo(
        roomId as string,
        canAccessClientView ? user : null,
        canAccessClientView ? session : null
    );

    useEffect(() => {
        if (!authLoading && !canAccessClientView) {
            router.push("/");
        }
    }, [authLoading, canAccessClientView, router]);

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
                    <p className="text-foreground text-lg">Loading...</p>
                </div>
            </div>
        );
    }

    if (!canAccessClientView) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background px-4">
                <div className="max-w-md w-full bg-foreground/5 rounded-xl border border-foreground/10 p-6 text-center">
                    <h1 className="text-2xl font-semibold text-foreground mb-2">
                        Sign In Required
                    </h1>
                    <p className="text-foreground/70 mb-4">
                        The client room view is only available to signed-in users.
                    </p>
                    <button
                        onClick={() => router.push("/")}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Go to Sign In
                    </button>
                </div>
            </div>
        );
    }

    if (!basicRoomInfo) {
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
