"use client";

import { useCallback, useRef } from "react";
import type { ZoneBoundingBox, ZoneSplitState } from "@/lib/canvas/engine";

interface DragInfo {
  index: number;
  boxLeft: number;
  boxTop: number;
  boxW: number;
  boxH: number;
}

interface ZoneSplitOverlayProps {
  /** Element the box percentages are relative to (fills exactly like the canvas). */
  containerRef: React.RefObject<HTMLElement | null>;
  sceneWidth: number;
  sceneHeight: number;
  box: ZoneBoundingBox;
  split: ZoneSplitState;
  onDragDivider: (index: number, fraction: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

/**
 * Draggable divider line(s) rendered directly over the live preview photo —
 * "drag a line left-right / up-down" to resize a zone's colour segments.
 * Mobile-friendly: pointer events + pointer capture + touch-action:none so
 * dragging never hijacks page scroll.
 */
export function ZoneSplitOverlay({
  containerRef,
  sceneWidth,
  sceneHeight,
  box,
  split,
  onDragDivider,
  onDragStart,
  onDragEnd,
}: ZoneSplitOverlayProps) {
  const dragRef = useRef<DragInfo | null>(null);
  const isVertical = split.orientation === "vertical";

  const beginDrag = useCallback(
    (index: number, e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      dragRef.current = {
        index,
        boxLeft: rect.left + (box.x / sceneWidth) * rect.width,
        boxTop: rect.top + (box.y / sceneHeight) * rect.height,
        boxW: (box.w / sceneWidth) * rect.width,
        boxH: (box.h / sceneHeight) * rect.height,
      };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      onDragStart?.();
    },
    [box, containerRef, sceneWidth, sceneHeight, onDragStart]
  );

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      e.preventDefault();
      const fraction = isVertical
        ? (e.clientX - drag.boxLeft) / drag.boxW
        : (e.clientY - drag.boxTop) / drag.boxH;
      onDragDivider(drag.index, fraction);
    },
    [isVertical, onDragDivider]
  );

  const endDrag = useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null;
      onDragEnd?.();
    }
  }, [onDragEnd]);

  const boxStyle: React.CSSProperties = {
    position: "absolute",
    left: `${(box.x / sceneWidth) * 100}%`,
    top: `${(box.y / sceneHeight) * 100}%`,
    width: `${(box.w / sceneWidth) * 100}%`,
    height: `${(box.h / sceneHeight) * 100}%`,
    pointerEvents: "none",
  };

  return (
    <div style={boxStyle}>
      {split.dividers.map((d, i) => {
        const anchorStyle: React.CSSProperties = isVertical
          ? { position: "absolute", left: `${d * 100}%`, top: 0, height: "100%", width: 0 }
          : { position: "absolute", top: `${d * 100}%`, left: 0, width: "100%", height: 0 };
        return (
          <div key={i} style={anchorStyle}>
            {/* Visible divider line */}
            <div
              className={
                isVertical
                  ? "absolute top-0 h-full w-[3px] -translate-x-1/2 bg-brass shadow-[0_0_0_1px_rgba(255,255,255,0.85)]"
                  : "absolute left-0 h-[3px] w-full -translate-y-1/2 bg-brass shadow-[0_0_0_1px_rgba(255,255,255,0.85)]"
              }
            />
            {/* Wide invisible touch/drag strip along the full line — generous hit target on mobile */}
            <div
              onPointerDown={(e) => beginDrag(i, e)}
              onPointerMove={onMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={{
                touchAction: "none",
                pointerEvents: "auto",
                position: "absolute",
                cursor: isVertical ? "ew-resize" : "ns-resize",
                ...(isVertical
                  ? { left: -16, top: 0, width: 32, height: "100%" }
                  : { top: -16, left: 0, height: 32, width: "100%" }),
              }}
            />
            {/* Grab handle */}
            <div
              onPointerDown={(e) => beginDrag(i, e)}
              onPointerMove={onMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={{ touchAction: "none", pointerEvents: "auto" }}
              className={`absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-paper shadow-lg ${
                isVertical ? "cursor-ew-resize" : "cursor-ns-resize"
              }`}
            >
              <span className="text-[11px] leading-none">{isVertical ? "\u2194" : "\u2195"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
