export const SUGGESTIONS = [
  {
    slug: "weekend-low-budget",
    title: "Weekend Low Budget",
    tagline: "Due giorni, grandi ricordi, poca spesa",
    description:
      "Una fuga di fine settimana economica con ostelli, street food e cultura tutta a piedi. Perfetta per partire spontaneamente dal venerdì alla domenica.",
    durationDays: 2,
    budgetTier: "low" as const,
    season: "Tutto l'anno",
    accent: "#FF8C42",
    heroEmoji: "🎒",
    prompt:
      "Pianificami un weekend low budget partendo da Milano verso una città europea facile da raggiungere. Due giorni, massimo 200 euro inclusi i trasporti, dormire economico, mangiare locale, tour a piedi gratuiti e una sola esperienza culturale memorabile.",
  },
  {
    slug: "summer-escape",
    title: "Estate al Mare",
    tagline: "Sole, mare e pomeriggi lenti",
    description:
      "Una settimana costiera lenta con pranzi di pesce, aperitivi al tramonto e una giornata in barca. Per quando hai bisogno di sentire l'estate nelle ossa.",
    durationDays: 7,
    budgetTier: "mid" as const,
    season: "Estate",
    accent: "#1B4F8A",
    heroEmoji: "🌅",
    prompt:
      "Progettami una fuga estiva di 7 giorni lungo la costa mediterranea. Voglio un mix di giornate al mare, una gita in barca, due cene di pesce memorabili, una piccola città di carattere come base e mattine lente con un buon caffè. Budget medio, dormite boutique confortevoli.",
  },
  {
    slug: "city-break",
    title: "City Break",
    tagline: "Tre giorni di cultura, cibo e nightlife",
    description:
      "Un itinerario denso e design-forward: musei selezionati, passeggiate di quartiere, la migliore cena della città e un'esperienza fuori dai sentieri battuti.",
    durationDays: 3,
    budgetTier: "mid" as const,
    season: "Primavera o Autunno",
    accent: "#1B4F8A",
    heroEmoji: "🏛️",
    prompt:
      "Pianificami un city break di 3 giorni a Lisbona. Cura il miglior mix di design, cibo e musica — un museo imperdibile, due quartieri da camminare, l'unica cena migliore da prenotare, un punto panoramico al tramonto e una serata di fado. Salta le trappole turistiche ovvie.",
  },
];
