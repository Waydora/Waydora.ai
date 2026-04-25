export const SUGGESTIONS = [
  {
    slug: "weekend-low-budget",
    title: "Weekend Low Budget",
    tagline: "Two days, big memories, small spend",
    description:
      "A pocket-friendly weekend escape with hostels, street food, and walkable culture. Perfect for spontaneous Friday-to-Sunday getaways.",
    durationDays: 2,
    budgetTier: "low" as const,
    season: "Year-round",
    accent: "#FF8C42",
    heroEmoji: "🎒",
    prompt:
      "Plan me a low-budget weekend getaway from Milan to a charming European city I can reach easily. Two days, max 200 euros total including transport, sleep cheap, eat local, focus on free walking experiences and one memorable cultural highlight.",
  },
  {
    slug: "summer-escape",
    title: "Summer Escape",
    tagline: "Sun, sea, and slow afternoons",
    description:
      "A languid coastal week with seafood lunches, sunset apertivos, and one perfect boat day. For when you need to feel summer in your bones.",
    durationDays: 7,
    budgetTier: "mid" as const,
    season: "Summer",
    accent: "#1B4F8A",
    heroEmoji: "🌅",
    prompt:
      "Design a 7-day summer escape along the Mediterranean coast. I want a mix of beach days, one boat trip, two memorable seafood dinners, a small town with character to base myself, and slow mornings with great coffee. Mid-range budget, comfortable boutique stays.",
  },
  {
    slug: "city-break",
    title: "City Break",
    tagline: "Three days of culture, food, and night life",
    description:
      "A dense, design-forward city itinerary: museum highlights, neighborhood walks, the city's best dinner, and one off-the-tourist-trail experience.",
    durationDays: 3,
    budgetTier: "mid" as const,
    season: "Spring or Fall",
    accent: "#1B4F8A",
    heroEmoji: "🏛️",
    prompt:
      "Plan me a 3-day city break to Lisbon. Curate the best mix of design, food, and music — one must-see museum, two great neighborhoods to walk, the single best dinner reservation worth booking, a sunset viewpoint, and one fado night. Skip the obvious tourist traps.",
  },
];
