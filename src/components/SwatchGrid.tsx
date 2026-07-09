"use client";

import { motion } from "framer-motion";

interface SwatchGridProps<T extends { id: string; name: string; hex: string }> {
  items: T[];
  selectedHex: string;
  onSelect: (hex: string) => void;
}

export function SwatchGrid<T extends { id: string; name: string; hex: string }>({
  items,
  selectedHex,
  onSelect,
}: SwatchGridProps<T>) {
  return (
    <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
      {items.map((item) => {
        const active = item.hex.toLowerCase() === selectedHex.toLowerCase();
        return (
          <motion.button
            key={item.id}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(item.hex)}
            className="flex flex-col items-center gap-1.5"
          >
            <span
              className={`h-10 w-10 rounded-full border-2 shadow-sm transition-all sm:h-12 sm:w-12 ${
                active
                  ? "border-brass ring-2 ring-brass/40 ring-offset-2 ring-offset-marble"
                  : "border-divider"
              }`}
              style={{ backgroundColor: item.hex }}
            />
            <span className="text-center text-[10px] leading-tight text-muted sm:text-xs">
              {item.name}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
