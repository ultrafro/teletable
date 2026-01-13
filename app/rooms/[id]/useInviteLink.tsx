import { useState, useCallback } from "react";

export function useInviteLink(roomId?: string) {
  const [linkCopied, setLinkCopied] = useState(false);

  const getInviteLink = useCallback(() => {
    if (roomId) {
      const baseUrl = window.location.origin;
      return `${baseUrl}/room/${roomId}`;
    }
    // Fallback: try to extract roomId from current URL
    const urlMatch = window.location.pathname.match(/\/(host|room)\/(.+)$/);
    if (urlMatch && urlMatch[2]) {
      const baseUrl = window.location.origin;
      return `${baseUrl}/room/${urlMatch[2]}`;
    }
    return window.location.href;
  }, [roomId]);

  const handleCopyInviteLink = useCallback(async () => {
    try {
      const clientUrl = getInviteLink();
      
      await navigator.clipboard.writeText(clientUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      const clientUrl = getInviteLink();
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
  }, [getInviteLink]);

  const handleOpenInviteLink = useCallback(() => {
    const clientUrl = getInviteLink();
    window.open(clientUrl, "_blank");
  }, [getInviteLink]);

  return {
    linkCopied,
    handleCopyInviteLink,
    handleOpenInviteLink,
  };
}
