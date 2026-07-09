import { rmSync } from "fs";

try {
  rmSync(".next", { recursive: true, force: true });
  console.log("Removed .next cache");
} catch (err) {
  console.warn("Could not remove .next:", err.message);
  console.warn("Stop all npm run dev terminals, then run: npm run clean");
  process.exit(1);
}
