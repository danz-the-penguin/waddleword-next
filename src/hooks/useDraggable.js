// src/hooks/useDraggable.js - Drag handler for floating retro Win98 dialogs
import { useState, useCallback, useEffect, useRef } from "react";

export function useDraggable() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback(
    (e) => {
      // Only drag if left click
      if (e.button !== 0) return;
      if (e.target.tagName === "BUTTON") return; // Don't drag when clicking buttons

      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };

      document.body.style.userSelect = "none";
    },
    [position],
  );

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isDraggingRef.current) return;

      let newX = e.clientX - dragStartRef.current.x;
      let newY = e.clientY - dragStartRef.current.y;

      const w = window.innerWidth;
      const h = window.innerHeight;

      // Clamp to keep it visible on screen
      newX = Math.max(-w / 2 + 100, Math.min(newX, w / 2 - 100));
      newY = Math.max(-h / 2 + 50, Math.min(newY, h / 2 - 50));

      setPosition({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  return { position, handlePointerDown };
}
