import type { RoomCategory } from "./scenes/types";

export interface RoomCategoryMeta {
  id: RoomCategory;
  label: string;
  /** Fallback gradient if cover image fails */
  gradient: string;
  accent: string;
  /** High-quality cover photo (Unsplash CDN) */
  coverImage: string;
}

/** Curated interior photos — Unsplash CDN, sized for gallery cards */
export const ROOM_CATEGORIES: RoomCategoryMeta[] = [
  {
    id: "kitchen",
    label: "Kitchen",
    gradient: "linear-gradient(145deg, #1c1410 0%, #5c3d28 45%, #b8893a 100%)",
    accent: "#b8893a",
    coverImage:
      "https://images.unsplash.com/photo-1556912173-46c336c7fd55?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "bathroom",
    label: "Bathroom",
    gradient: "linear-gradient(145deg, #152028 0%, #3a5568 50%, #8eb4c8 100%)",
    accent: "#3a5568",
    coverImage:
      "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "basement",
    label: "Basement",
    gradient: "linear-gradient(145deg, #12121a 0%, #2e2e42 50%, #6a6a88 100%)",
    accent: "#6a6a88",
    coverImage:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "tv-lounge",
    label: "TV Lounge",
    gradient: "linear-gradient(145deg, #1c1410 0%, #3d2a1c 50%, #8a6a3a 100%)",
    accent: "#8a6a3a",
    coverImage:
      "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "bedroom",
    label: "Bedroom",
    gradient: "linear-gradient(145deg, #1a1520 0%, #4a3a55 50%, #9a8ab0 100%)",
    accent: "#9a8ab0",
    coverImage:
      "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "other",
    label: "Other",
    gradient: "linear-gradient(145deg, #1c1410 0%, #4a3828 50%, #c9a87c 100%)",
    accent: "#c9a87c",
    coverImage:
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=80",
  },
];

export function getRoomMeta(id: RoomCategory): RoomCategoryMeta {
  return ROOM_CATEGORIES.find((r) => r.id === id) ?? ROOM_CATEGORIES[0];
}
