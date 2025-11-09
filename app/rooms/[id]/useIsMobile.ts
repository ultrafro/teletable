import { useEffect, useState } from "react";

function isMobile() {
  //do it based on ratio of width to height
  const width = window.innerWidth;
  const height = window.innerHeight;
  const ratio = width / height;
  if (ratio < 1) {
    return true;
  }
  return false;
}

export function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isMobileVar = isMobile();
      setMobile(isMobileVar);
    }

    const handleResize = () => {
      const isMobileVar = isMobile();
      setMobile(isMobileVar);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return mobile;
}
