# Aapki kitchen photos yahan rakhein

1. **base.png** — poori kitchen ki photo (jo aapne bheji)
2. **layer-cabinets.png** — sirf **lower cabinets** cutout, **pure black (#000000) background**

Layer file rules (mask sahi banne ke liye):
- Background bilkul kaala hona chahiye — grey/dark wall nahi
- Sirf cabinet pixels visible hon — poori photo mat rakhein
- Base photo jitna hi size (768x1024 etc.)

Phir terminal mein:

```bash
npm run process-real-kitchen
npm run analyze-mask          # mask stats check (10–30% active = OK)
npm run dev
```

Browser: http://localhost:3000/configurator/kitchen-real

Dev console mein `[mask:kitchen-real/cabinets] X% active pixels` dikhega.

Baad mein aur layers (wall, shelves) bhej sakte hain — hum mask add kar denge.
