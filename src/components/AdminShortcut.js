"use client";

import { useEffect } from "react";

export default function AdminShortcut() {
  useEffect(() => {
    function handleShortcut(event) {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        window.location.assign("/admin-login");
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  return null;
}
