/**
 * Room topology. In a real deployment each room maps to an MQTT topic prefix
 * such as `home/living/#`, which is why every room carries a stable `id`.
 */
export const ROOMS = [
  {
    id: 'living',
    name: 'Living Room',
    icon: 'Sofa',
    topic: 'home/living',
    /** m² — drives how fast the thermal model heats and cools the room. */
    area: 28,
    /** Baseline chance (0-1) that someone is in this room while Home. */
    occupancy: { home: 0.72, away: 0, night: 0.05 },
    accent: 'emerald',
  },
  {
    id: 'bedroom',
    name: 'Bedroom',
    icon: 'BedDouble',
    topic: 'home/bedroom',
    area: 18,
    occupancy: { home: 0.3, away: 0, night: 0.9 },
    accent: 'indigo',
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    icon: 'CookingPot',
    topic: 'home/kitchen',
    area: 14,
    occupancy: { home: 0.35, away: 0, night: 0.04 },
    accent: 'amber',
  },
  {
    id: 'study',
    name: 'Study Room',
    icon: 'BookOpen',
    topic: 'home/study',
    area: 12,
    occupancy: { home: 0.4, away: 0, night: 0.03 },
    accent: 'cyan',
  },
]

export const ROOM_MAP = Object.fromEntries(ROOMS.map((r) => [r.id, r]))

export const roomName = (id) => ROOM_MAP[id]?.name ?? (id === 'entry' ? 'Entry' : id)
