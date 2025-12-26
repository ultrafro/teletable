import { useState, useCallback } from "react";

export function useInviteLink(roomId?: string) {
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyInviteLink = useCallback(async () => {
    try {
      // Generate client URL - convert /host/roomId to /room/roomId
      let clientUrl = window.location.href;
      if (roomId) {
        const baseUrl = window.location.origin;
        clientUrl = `${baseUrl}/room/${roomId}`;
      } else {
        // Fallback: try to extract roomId from current URL
        const urlMatch = window.location.pathname.match(/\/(host|room)\/(.+)$/);
        if (urlMatch && urlMatch[2]) {
          const baseUrl = window.location.origin;
          clientUrl = `${baseUrl}/room/${urlMatch[2]}`;
        }
      }
      
      await navigator.clipboard.writeText(clientUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      let clientUrl = window.location.href;
      if (roomId) {
        const baseUrl = window.location.origin;
        clientUrl = `${baseUrl}/room/${roomId}`;
      } else {
        const urlMatch = window.location.pathname.match(/\/(host|room)\/(.+)$/);
        if (urlMatch && urlMatch[2]) {
          const baseUrl = window.location.origin;
          clientUrl = `${baseUrl}/room/${urlMatch[2]}`;
        }
      }
      textArea.value = clientUrl;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } catch (fallbackErr) {
        console.error("Fallback copy failed:", fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  }, [roomId]);

  return {
    linkCopied,
    handleCopyInviteLink,
  };
}
