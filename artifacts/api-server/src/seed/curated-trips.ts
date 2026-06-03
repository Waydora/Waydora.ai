// curated-trips.ts
// ─────────────────────────────────────────────────────────────────────────────
// Viaggi pre-costruiti (TEMPLATE) per il funnel TikTok — Settimana 1.
//
// Ogni voce è un itinerario CANONICO di sola lettura. Lo slug è l'URL del video:
//   waydora.com/trip/<slug>   (es. /trip/santorini)
//
// MODELLO template → fork: questi sono template (isTemplate: true). La pagina /trip
// li mostra in sola lettura con CTA "Personalizza"; alla personalizzazione si crea
// una COPIA PRIVATA con nuovo slug (il template resta intatto). Vedi piano funnel.
//
// SEMINA: il contenuto `itinerary` va inserito nella tabella letta da trip.tsx
// (Supabase `saved_trips`: colonne share_slug, itinerary jsonb, title, is_template).
// ⚠️ Confermare prima l'allineamento tabella (saved_trips vs itinerariesTable Drizzle).
// ─────────────────────────────────────────────────────────────────────────────

export type CuratedActivity = {
  time: string;
  title: string;
  description: string;
  category: "stay" | "food" | "experience" | "transport" | "sightseeing" | "nightlife";
  estimatedCost?: string;
  coordinates?: { lat: number; lng: number };
  photoQuery?: string;
};

export type CuratedDay = {
  day: number;
  title: string;
  summary: string;
  activities: CuratedActivity[];
};

export type CuratedItinerary = {
  title: string;
  destination: string;
  durationDays: number;
  vibe: string;
  totalBudget: string;
  bestSeason: string;
  heroEmoji: string;
  days: CuratedDay[];
  packingList: { category: string; items: string[] }[];
};

export type CuratedTrip = {
  slug: string;          // URL del video TikTok: /trip/<slug>
  isTemplate: true;      // sola lettura + fork-on-edit
  itinerary: CuratedItinerary;
};

export const CURATED_TRIPS: CuratedTrip[] = [
  // ── 1) SANTORINI ───────────────────────────────────────────────────────────
  {
    slug: "santorini",
    isTemplate: true,
    itinerary: {
      title: "Santorini in 3 giorni: tramonti, caldera e mare",
      destination: "Santorini, Grecia",
      durationDays: 3,
      vibe: "Romantico, panoramico, slow",
      totalBudget: "€450–650 a persona (volo escluso)",
      bestSeason: "Maggio–giugno e settembre (meno folla, clima perfetto)",
      heroEmoji: "🌅",
      days: [
        {
          day: 1,
          title: "Fira e la caldera",
          summary: "Arrivo, primo affaccio sulla caldera e tramonto sul vulcano.",
          activities: [
            { time: "11:00", title: "Check-in a Fira", description: "Sistemazione nel capoluogo, comodo e ben collegato. Lascia i bagagli e respira la vista sulla caldera.", category: "stay", estimatedCost: "€90–140/notte", coordinates: { lat: 36.4167, lng: 25.4333 }, photoQuery: "Fira Santorini caldera view" },
            { time: "13:00", title: "Pranzo con vista a Fira", description: "Taverna sul bordo caldera: insalata greca, fava santorinese e pomodorini locali.", category: "food", estimatedCost: "€18–25", coordinates: { lat: 36.4154, lng: 25.4316 }, photoQuery: "Santorini taverna caldera lunch" },
            { time: "16:00", title: "Sentiero Fira–Firostefani", description: "Passeggiata panoramica facile lungo il bordo della caldera, tra cupole blu e mulini.", category: "sightseeing", estimatedCost: "Gratis", coordinates: { lat: 36.4233, lng: 25.4292 }, photoQuery: "Firostefani blue domes path" },
            { time: "19:30", title: "Tramonto sulla caldera", description: "Il primo tramonto: aperitivo in un wine bar affacciato sul vulcano, lontano dalla calca di Oia.", category: "nightlife", estimatedCost: "€12–20", coordinates: { lat: 36.4170, lng: 25.4310 }, photoQuery: "Santorini sunset wine bar caldera" },
          ],
        },
        {
          day: 2,
          title: "Oia e il nord dell'isola",
          summary: "Il villaggio più iconico, un bagno alle terme e il tramonto famoso nel mondo.",
          activities: [
            { time: "09:30", title: "Mattinata a Oia", description: "Vicoli bianchi, cupole blu e gallerie d'arte prima dell'arrivo dei bus turistici. Le foto migliori sono presto.", category: "sightseeing", estimatedCost: "Gratis", coordinates: { lat: 36.4618, lng: 25.3753 }, photoQuery: "Oia Santorini blue domes morning" },
            { time: "12:30", title: "Pranzo ad Ammoudi Bay", description: "Scendi i 300 gradini fino al porticciolo: pesce freschissimo a pelo d'acqua.", category: "food", estimatedCost: "€25–35", coordinates: { lat: 36.4641, lng: 25.3686 }, photoQuery: "Ammoudi Bay seafood Santorini" },
            { time: "15:30", title: "Bagno alle Hot Springs", description: "Mini-crociera alle sorgenti termali vulcaniche: acqua tiepida color ocra nella caldera.", category: "experience", estimatedCost: "€25–40", coordinates: { lat: 36.4010, lng: 25.4060 }, photoQuery: "Santorini volcano hot springs boat" },
            { time: "20:00", title: "Il tramonto di Oia", description: "Il tramonto più fotografato al mondo dal castello di Oia. Arriva 45 min prima per un posto.", category: "experience", estimatedCost: "Gratis", coordinates: { lat: 36.4623, lng: 25.3744 }, photoQuery: "Oia castle sunset crowd" },
          ],
        },
        {
          day: 3,
          title: "Spiagge vulcaniche e vino",
          summary: "Il lato meno noto: sabbia nera e rossa, un sito archeologico e cantine.",
          activities: [
            { time: "10:00", title: "Red Beach", description: "Spiaggia di sabbia rossa sotto scogliere vulcaniche, vicino agli scavi di Akrotiri.", category: "sightseeing", estimatedCost: "Gratis", coordinates: { lat: 36.3486, lng: 25.3947 }, photoQuery: "Red Beach Santorini cliffs" },
            { time: "12:00", title: "Akrotiri, la Pompei dell'Egeo", description: "Città minoica sepolta da un'eruzione 3.600 anni fa, sorprendentemente conservata.", category: "experience", estimatedCost: "€12", coordinates: { lat: 36.3517, lng: 25.4036 }, photoQuery: "Akrotiri archaeological site Santorini" },
            { time: "14:30", title: "Pranzo a Perissa (sabbia nera)", description: "Lungomare rilassato sulla spiaggia nera, taverne semplici e prezzi onesti.", category: "food", estimatedCost: "€15–22", coordinates: { lat: 36.3553, lng: 25.4783 }, photoQuery: "Perissa black sand beach taverna" },
            { time: "17:00", title: "Degustazione in cantina", description: "L'Assyrtiko cresce ad anello sul suolo vulcanico: degustazione al tramonto a Pyrgos.", category: "food", estimatedCost: "€20–30", coordinates: { lat: 36.3833, lng: 25.4500 }, photoQuery: "Santorini winery Assyrtiko sunset" },
          ],
        },
      ],
      packingList: [
        { category: "Abbigliamento", items: ["Scarpe comode per i gradini", "Abito chiaro per le foto", "Costume", "Felpa leggera per la sera"] },
        { category: "Essenziali", items: ["Crema solare alta protezione", "Cappello", "Borraccia", "Power bank"] },
        { category: "Documenti", items: ["Carta d'identità/passaporto", "Tessera sanitaria europea"] },
      ],
    },
  },

  // ── 2) KYOTO ─────────────────────────────────────────────────────────────────
  {
    slug: "kyoto",
    isTemplate: true,
    itinerary: {
      title: "Kyoto in 3 giorni: templi, bambù e geishe",
      destination: "Kyoto, Giappone",
      durationDays: 3,
      vibe: "Culturale, spirituale, autentico",
      totalBudget: "€350–500 a persona (volo escluso)",
      bestSeason: "Aprile (fioritura) e novembre (foliage)",
      heroEmoji: "⛩️",
      days: [
        {
          day: 1,
          title: "Higashiyama e Gion",
          summary: "Il cuore antico: templi, vicoli di pietra e il quartiere delle geishe.",
          activities: [
            { time: "08:30", title: "Kiyomizu-dera all'apertura", description: "Tempio sospeso sulla collina con vista sulla città. Presto è quasi vuoto.", category: "sightseeing", estimatedCost: "¥500 (~€3)", coordinates: { lat: 34.9949, lng: 135.7850 }, photoQuery: "Kiyomizu-dera temple Kyoto morning" },
            { time: "10:30", title: "Sannenzaka e Ninenzaka", description: "Stradine in salita di epoca Edo, case di legno, sale da tè e botteghe.", category: "experience", estimatedCost: "Gratis", coordinates: { lat: 34.9971, lng: 135.7805 }, photoQuery: "Ninenzaka Kyoto old street" },
            { time: "13:00", title: "Pranzo: udon o tofu kaiseki", description: "Cucina di Kyoto: tofu yudofu o una ciotola di udon caldo in una casa tradizionale.", category: "food", estimatedCost: "€12–20", coordinates: { lat: 34.9990, lng: 135.7820 }, photoQuery: "Kyoto tofu kaiseki meal" },
            { time: "17:30", title: "Gion al tramonto", description: "Il quartiere delle geishe: con fortuna vedi una maiko diretta a un appuntamento. Rispetta gli spazi.", category: "nightlife", estimatedCost: "Gratis", coordinates: { lat: 35.0037, lng: 135.7752 }, photoQuery: "Gion Kyoto geisha evening" },
          ],
        },
        {
          day: 2,
          title: "Arashiyama e il nord-ovest",
          summary: "La foresta di bambù all'alba, un tempio zen e le scimmie di montagna.",
          activities: [
            { time: "08:00", title: "Foresta di bambù di Arashiyama", description: "Il sentiero tra i bambù va vissuto presto: alle 8 la luce filtra e non c'è nessuno.", category: "sightseeing", estimatedCost: "Gratis", coordinates: { lat: 35.0170, lng: 135.6710 }, photoQuery: "Arashiyama bamboo grove empty morning" },
            { time: "09:30", title: "Tempio Tenryu-ji", description: "Giardino zen patrimonio UNESCO, progettato per incorniciare le montagne dietro.", category: "experience", estimatedCost: "¥500 (~€3)", coordinates: { lat: 35.0157, lng: 135.6739 }, photoQuery: "Tenryu-ji zen garden Kyoto" },
            { time: "12:30", title: "Pranzo lungo il fiume Katsura", description: "Bento o soba con vista sul ponte Togetsukyo e le colline boscose.", category: "food", estimatedCost: "€12–18", coordinates: { lat: 35.0130, lng: 135.6780 }, photoQuery: "Katsura river Arashiyama bridge" },
            { time: "15:00", title: "Kinkaku-ji, il Padiglione d'Oro", description: "Il tempio ricoperto d'oro che si specchia nel laghetto: l'immagine simbolo di Kyoto.", category: "sightseeing", estimatedCost: "¥500 (~€3)", coordinates: { lat: 35.0394, lng: 135.7292 }, photoQuery: "Kinkaku-ji golden pavilion reflection" },
          ],
        },
        {
          day: 3,
          title: "Fushimi Inari e il sake",
          summary: "Le mille torii rosse all'alba e il quartiere delle distillerie.",
          activities: [
            { time: "07:30", title: "Fushimi Inari all'alba", description: "Migliaia di torii vermiglie su per la montagna. All'alba è magico e deserto: sali almeno fino al belvedere.", category: "sightseeing", estimatedCost: "Gratis", coordinates: { lat: 34.9671, lng: 135.7727 }, photoQuery: "Fushimi Inari torii gates sunrise" },
            { time: "11:00", title: "Street food a Nishiki Market", description: "Il 'cucinino di Kyoto': spiedini, tamagoyaki, mochi e tè matcha lungo una galleria coperta.", category: "food", estimatedCost: "€10–18", coordinates: { lat: 35.0050, lng: 135.7649 }, photoQuery: "Nishiki market Kyoto street food" },
            { time: "14:00", title: "Distretto del sake di Fushimi", description: "Cantine storiche lungo i canali: degustazione di sake nelle acque pure di Kyoto.", category: "experience", estimatedCost: "€8–15", coordinates: { lat: 34.9320, lng: 135.7610 }, photoQuery: "Fushimi sake district canal Kyoto" },
            { time: "17:00", title: "Tè matcha in una sala storica", description: "Cerimonia del tè semplificata: l'amaro del matcha con un wagashi di stagione.", category: "food", estimatedCost: "€10–16", coordinates: { lat: 35.0036, lng: 135.7788 }, photoQuery: "matcha tea ceremony Kyoto" },
          ],
        },
      ],
      packingList: [
        { category: "Abbigliamento", items: ["Scarpe comodissime (si cammina tanto)", "Calzini puliti (ci si scalza nei templi)", "Strato impermeabile leggero"] },
        { category: "Essenziali", items: ["IC card (Suica/ICOCA) per i mezzi", "Pocket wifi o eSIM", "Asciugamano piccolo", "Contanti (molti posti no carta)"] },
        { category: "Documenti", items: ["Passaporto", "Japan Rail Pass se previsto"] },
      ],
    },
  },

  // ── 3) COSTIERA AMALFITANA ───────────────────────────────────────────────────
  {
    slug: "costiera-amalfitana",
    isTemplate: true,
    itinerary: {
      title: "Costiera Amalfitana in 3 giorni: Positano, Amalfi e Ravello",
      destination: "Costiera Amalfitana, Italia",
      durationDays: 3,
      vibe: "Mare, dolce vita, panorami",
      totalBudget: "€400–600 a persona",
      bestSeason: "Maggio–giugno e settembre",
      heroEmoji: "🍋",
      days: [
        {
          day: 1,
          title: "Positano",
          summary: "Il borgo verticale a picco sul mare, tra boutique e spiaggia.",
          activities: [
            { time: "10:00", title: "Arrivo e check-in a Positano", description: "Lascia i bagagli: Positano si gira solo a piedi, tra scalinate e bouganville.", category: "stay", estimatedCost: "€110–180/notte", coordinates: { lat: 40.6281, lng: 14.4850 }, photoQuery: "Positano cliff village Amalfi Coast" },
            { time: "11:30", title: "Spiaggia Grande e Marina", description: "Il colpo d'occhio classico: ombrelloni, barche e le case pastello che salgono.", category: "sightseeing", estimatedCost: "Gratis / lettino €15–25", coordinates: { lat: 40.6263, lng: 14.4847 }, photoQuery: "Positano Spiaggia Grande beach" },
            { time: "13:30", title: "Pranzo di mare", description: "Spaghetti alle vongole o scialatielli ai frutti di mare con i piedi quasi nell'acqua.", category: "food", estimatedCost: "€25–40", coordinates: { lat: 40.6270, lng: 14.4855 }, photoQuery: "Positano seafood pasta restaurant" },
            { time: "18:30", title: "Aperitivo al tramonto", description: "Spritz al limoncello con vista sulla cupola maiolicata di Santa Maria Assunta.", category: "nightlife", estimatedCost: "€10–18", coordinates: { lat: 40.6285, lng: 14.4848 }, photoQuery: "Positano sunset aperitivo dome" },
          ],
        },
        {
          day: 2,
          title: "Sentiero degli Dei e Amalfi",
          summary: "Il trekking panoramico più bello d'Italia e la cittadina che dà il nome alla costa.",
          activities: [
            { time: "08:30", title: "Sentiero degli Dei", description: "Da Bomerano a Nocelle: 7 km in quota a strapiombo sul mare, tra i panorami più belli d'Europa.", category: "experience", estimatedCost: "Gratis (bus per Bomerano)", coordinates: { lat: 40.6233, lng: 14.5170 }, photoQuery: "Sentiero degli Dei Amalfi Coast trail" },
            { time: "13:00", title: "Pranzo ad Amalfi", description: "Nel cuore dell'antica Repubblica Marinara: scialatielli e la celebre delizia al limone.", category: "food", estimatedCost: "€20–30", coordinates: { lat: 40.6340, lng: 14.6027 }, photoQuery: "Amalfi town piazza duomo" },
            { time: "15:00", title: "Duomo di Sant'Andrea", description: "La scenografica scalinata e gli interni arabo-normanni del simbolo di Amalfi.", category: "sightseeing", estimatedCost: "€3", coordinates: { lat: 40.6342, lng: 14.6029 }, photoQuery: "Amalfi cathedral staircase" },
            { time: "17:00", title: "Carta e limoncello", description: "Botteghe della carta a mano di Amalfi e degustazione del limoncello degli sfusato locale.", category: "experience", estimatedCost: "€5–15", coordinates: { lat: 40.6345, lng: 14.6010 }, photoQuery: "Amalfi limoncello shop" },
          ],
        },
        {
          day: 3,
          title: "Ravello",
          summary: "Il balcone della costiera, tra ville, giardini e musica.",
          activities: [
            { time: "10:00", title: "Villa Rufolo", description: "Giardini fioriti a picco sul golfo che ispirarono Wagner: la terrazza è iconica.", category: "sightseeing", estimatedCost: "€7", coordinates: { lat: 40.6490, lng: 14.6116 }, photoQuery: "Villa Rufolo Ravello garden terrace" },
            { time: "12:00", title: "Terrazza dell'Infinito (Villa Cimbrone)", description: "La balconata di busti marmorei sospesa nel vuoto: la vista più celebre della costiera.", category: "experience", estimatedCost: "€10", coordinates: { lat: 40.6463, lng: 14.6128 }, photoQuery: "Villa Cimbrone Terrace of Infinity" },
            { time: "13:30", title: "Pranzo a Ravello", description: "Cucina di terra e di mare in un borgo tranquillo, lontano dalla folla del mare.", category: "food", estimatedCost: "€22–35", coordinates: { lat: 40.6497, lng: 14.6118 }, photoQuery: "Ravello restaurant terrace view" },
            { time: "16:00", title: "Passeggiata e ceramiche", description: "Piazza Duomo, botteghe di ceramica vietrese e un ultimo gelato al limone.", category: "sightseeing", estimatedCost: "€5–20", coordinates: { lat: 40.6489, lng: 14.6111 }, photoQuery: "Ravello ceramics piazza" },
          ],
        },
      ],
      packingList: [
        { category: "Abbigliamento", items: ["Scarpe da trekking per il Sentiero degli Dei", "Sandali comodi", "Costume e telo mare", "Qualcosa di elegante per la sera"] },
        { category: "Essenziali", items: ["Crema solare", "Borraccia", "Contanti per i bus SITA", "App orari traghetti"] },
        { category: "Documenti", items: ["Carta d'identità", "Prenotazioni traghetti/bus"] },
      ],
    },
  },

  // ── 4) BALI ──────────────────────────────────────────────────────────────────
  {
    slug: "bali",
    isTemplate: true,
    itinerary: {
      title: "Bali in 3 giorni: risaie, templi e spiagge",
      destination: "Bali, Indonesia",
      durationDays: 3,
      vibe: "Spirituale, natura, relax",
      totalBudget: "€250–400 a persona (volo escluso)",
      bestSeason: "Aprile–ottobre (stagione secca)",
      heroEmoji: "🌴",
      days: [
        {
          day: 1,
          title: "Ubud e le risaie",
          summary: "Il cuore verde e spirituale dell'isola.",
          activities: [
            { time: "09:00", title: "Risaie di Tegallalang", description: "Terrazze di riso a gradoni nella giungla: vai presto, prima dei pullman e del caldo.", category: "sightseeing", estimatedCost: "~€1 + offerta", coordinates: { lat: -8.4312, lng: 115.2778 }, photoQuery: "Tegallalang rice terraces Bali morning" },
            { time: "11:30", title: "Sacred Monkey Forest", description: "Riserva nel bosco con templi muschiati e macachi liberi. Tieni stretti occhiali e cibo.", category: "experience", estimatedCost: "~€5", coordinates: { lat: -8.5188, lng: 115.2586 }, photoQuery: "Ubud monkey forest temple" },
            { time: "13:30", title: "Pranzo healthy a Ubud", description: "Nasi campur o una bowl tropicale in uno dei tanti café tra le risaie.", category: "food", estimatedCost: "€5–10", coordinates: { lat: -8.5069, lng: 115.2625 }, photoQuery: "Ubud cafe healthy bowl" },
            { time: "18:00", title: "Danza Kecak al tramonto", description: "Spettacolo di fuoco e canto tribale balinese: ipnotico, da vivere dal vivo.", category: "nightlife", estimatedCost: "€6–10", coordinates: { lat: -8.5095, lng: 115.2620 }, photoQuery: "Kecak fire dance Bali sunset" },
          ],
        },
        {
          day: 2,
          title: "Templi e cascate",
          summary: "Il Bali da cartolina: porte celesti, sorgenti sacre e giungla.",
          activities: [
            { time: "07:00", title: "Lempuyang, la 'Porta del Paradiso'", description: "La porta che incornicia il vulcano Agung. Vai all'alba: la fila qui diventa enorme.", category: "sightseeing", estimatedCost: "~€3", coordinates: { lat: -8.3919, lng: 115.6310 }, photoQuery: "Lempuyang gates of heaven Bali" },
            { time: "10:30", title: "Tempio Tirta Empul", description: "Sorgente sacra dove i balinesi si purificano sotto le fontane. Si può partecipare con rispetto.", category: "experience", estimatedCost: "~€3", coordinates: { lat: -8.4156, lng: 115.3153 }, photoQuery: "Tirta Empul holy water temple Bali" },
            { time: "13:00", title: "Pranzo con vista vulcano (Kintamani)", description: "Buffet panoramico davanti al Monte Batur e al suo lago craterico.", category: "food", estimatedCost: "€8–14", coordinates: { lat: -8.2422, lng: 115.3608 }, photoQuery: "Kintamani Mount Batur view restaurant" },
            { time: "15:30", title: "Cascata Tibumana", description: "Cascata nella giungla meno affollata delle altre: bagno rinfrescante nella pozza.", category: "sightseeing", estimatedCost: "~€2", coordinates: { lat: -8.5575, lng: 115.3242 }, photoQuery: "Tibumana waterfall Bali jungle" },
          ],
        },
        {
          day: 3,
          title: "Sud: spiagge e scogliere",
          summary: "Surf, tempio sul mare e tramonto sull'oceano.",
          activities: [
            { time: "09:30", title: "Spiaggia di Padang Padang", description: "Caletta tra le rocce amata dai surfisti, acqua turchese e atmosfera rilassata.", category: "sightseeing", estimatedCost: "~€1", coordinates: { lat: -8.8110, lng: 115.1027 }, photoQuery: "Padang Padang beach Bali" },
            { time: "12:30", title: "Pranzo a Uluwatu", description: "Warung sulla scogliera: pesce alla griglia e fresh coconut con vista oceano.", category: "food", estimatedCost: "€6–12", coordinates: { lat: -8.8291, lng: 115.0849 }, photoQuery: "Uluwatu cliff warung Bali" },
            { time: "16:00", title: "Tempio di Uluwatu", description: "Tempio a picco sull'oceano a 70 m d'altezza, tra macachi e onde che s'infrangono.", category: "experience", estimatedCost: "~€3", coordinates: { lat: -8.8291, lng: 115.0889 }, photoQuery: "Uluwatu temple cliff ocean Bali" },
            { time: "18:30", title: "Tramonto a Single Fin", description: "Lo spot tramonto più celebre dell'isola, a strapiombo sulle onde di Uluwatu.", category: "nightlife", estimatedCost: "€6–12", coordinates: { lat: -8.8147, lng: 115.0888 }, photoQuery: "Single Fin Uluwatu sunset" },
          ],
        },
      ],
      packingList: [
        { category: "Abbigliamento", items: ["Sarong (serve nei templi)", "Costume", "Infradito + scarpe da scoglio", "Repellente zanzare"] },
        { category: "Essenziali", items: ["Crema solare reef-safe", "Contanti in rupie", "App Grab/Gojek per gli spostamenti", "Adattatore presa"] },
        { category: "Salute", items: ["Disinfettante mani", "Farmaci base", "Acqua in bottiglia sigillata"] },
      ],
    },
  },

  // ── 5) DOLOMITI ──────────────────────────────────────────────────────────────
  {
    slug: "dolomiti",
    isTemplate: true,
    itinerary: {
      title: "Dolomiti in 3 giorni: laghi, rifugi e vette",
      destination: "Dolomiti, Italia",
      durationDays: 3,
      vibe: "Montagna, trekking, aria pulita",
      totalBudget: "€300–450 a persona",
      bestSeason: "Fine giugno–settembre",
      heroEmoji: "🏔️",
      days: [
        {
          day: 1,
          title: "Lago di Braies",
          summary: "Il lago alpino più fotografato delle Alpi.",
          activities: [
            { time: "07:30", title: "Lago di Braies all'alba", description: "Lo smeraldo incorniciato dalle pareti: presto è specchio perfetto e parcheggio libero (in alta stagione c'è limite traffico).", category: "sightseeing", estimatedCost: "Parcheggio €6–28", coordinates: { lat: 46.6947, lng: 12.0856 }, photoQuery: "Lago di Braies sunrise Dolomites" },
            { time: "09:00", title: "Giro del lago + barca a remi", description: "Anello pianeggiante di 3,5 km e, se vuoi, le tipiche barche di legno sull'acqua verde.", category: "experience", estimatedCost: "Barca €32/30min", coordinates: { lat: 46.6950, lng: 12.0870 }, photoQuery: "Braies wooden boats lake" },
            { time: "13:00", title: "Pranzo in malga", description: "Canederli, speck e strudel in una malga di legno con vista sui prati.", category: "food", estimatedCost: "€15–22", coordinates: { lat: 46.7000, lng: 12.1000 }, photoQuery: "Dolomites malga canederli lunch" },
            { time: "16:00", title: "Relax a Dobbiaco", description: "Passeggiata nel paese e ai prati della Val di Landro, primo assaggio delle Tre Cime.", category: "sightseeing", estimatedCost: "Gratis", coordinates: { lat: 46.7350, lng: 12.2230 }, photoQuery: "Dobbiaco village Dolomites" },
          ],
        },
        {
          day: 2,
          title: "Tre Cime di Lavaredo",
          summary: "Il trekking simbolo delle Dolomiti, attorno alle tre torri.",
          activities: [
            { time: "08:00", title: "Salita al Rifugio Auronzo", description: "Strada a pedaggio fino a 2.320 m: punto di partenza del giro delle Tre Cime.", category: "transport", estimatedCost: "Pedaggio €30/auto", coordinates: { lat: 46.6133, lng: 12.2950 }, photoQuery: "Rifugio Auronzo Tre Cime" },
            { time: "09:00", title: "Giro delle Tre Cime", description: "Anello di ~10 km (3–4 h) di media difficoltà attorno alle tre vette: panorami a 360°.", category: "experience", estimatedCost: "Gratis", coordinates: { lat: 46.6186, lng: 12.3050 }, photoQuery: "Tre Cime di Lavaredo trail hike" },
            { time: "12:30", title: "Pranzo al Rifugio Locatelli", description: "Il rifugio con la vista frontale sulle Tre Cime: zuppa d'orzo e torta di mele.", category: "food", estimatedCost: "€15–20", coordinates: { lat: 46.6228, lng: 12.3080 }, photoQuery: "Rifugio Locatelli Tre Cime view" },
            { time: "16:30", title: "Rientro panoramico", description: "Discesa lenta godendosi i laghetti dei Piani e la luce del pomeriggio sulle pareti.", category: "sightseeing", estimatedCost: "Gratis", coordinates: { lat: 46.6160, lng: 12.3000 }, photoQuery: "Laghi dei Piani Dolomites" },
          ],
        },
        {
          day: 3,
          title: "Val di Funes e Seceda",
          summary: "Le creste affilate e la chiesetta più fotografata delle Alpi.",
          activities: [
            { time: "08:30", title: "Chiesetta di San Giovanni in Ranui", description: "La cappella isolata nei prati con le Odle dietro: una delle cartoline d'Italia.", category: "sightseeing", estimatedCost: "€4", coordinates: { lat: 46.6386, lng: 11.7158 }, photoQuery: "San Giovanni Ranui church Odle" },
            { time: "10:30", title: "Funivia per Seceda", description: "Sali a 2.500 m: le creste erbose che precipitano sulle guglie sono spettacolari.", category: "transport", estimatedCost: "€40 a/r", coordinates: { lat: 46.6090, lng: 11.7350 }, photoQuery: "Seceda ridgeline Dolomites" },
            { time: "12:30", title: "Pranzo in quota", description: "Rifugio sui prati di Seceda: polenta e formaggio davanti alle Odle.", category: "food", estimatedCost: "€16–24", coordinates: { lat: 46.6100, lng: 11.7300 }, photoQuery: "Seceda rifugio polenta lunch" },
            { time: "15:00", title: "Passeggiata sui prati di Ortisei", description: "Discesa dolce e giro nel paese ladino, tra botteghe di legno intagliato.", category: "experience", estimatedCost: "Gratis", coordinates: { lat: 46.5760, lng: 11.6720 }, photoQuery: "Ortisei village Val Gardena" },
          ],
        },
      ],
      packingList: [
        { category: "Trekking", items: ["Scarponcini da trekking", "Zaino con borraccia", "Bastoncini", "Giacca antivento/pioggia"] },
        { category: "Abbigliamento", items: ["Strati (fa fresco in quota anche d'estate)", "Pile", "Cappello e occhiali da sole", "Cambio calzini"] },
        { category: "Essenziali", items: ["Crema solare (sole forte in quota)", "Snack energetici", "Contanti per rifugi", "Powerbank"] },
      ],
    },
  },

  // ── 6) POLIGNANO A MARE ──────────────────────────────────────────────────────
  {
    slug: "polignano-a-mare",
    isTemplate: true,
    itinerary: {
      title: "Polignano a Mare e dintorni in 3 giorni",
      destination: "Polignano a Mare, Puglia",
      durationDays: 3,
      vibe: "Mare, borghi bianchi, autentico",
      totalBudget: "€280–420 a persona",
      bestSeason: "Maggio–giugno e settembre",
      heroEmoji: "🏖️",
      days: [
        {
          day: 1,
          title: "Polignano a Mare",
          summary: "Il borgo a strapiombo sul mare e la sua spiaggia in grotta.",
          activities: [
            { time: "10:30", title: "Centro storico e terrazze", description: "Vicoli bianchi, versi poetici sui muri e i balconi affacciati sull'Adriatico.", category: "sightseeing", estimatedCost: "Gratis", coordinates: { lat: 40.9959, lng: 17.2186 }, photoQuery: "Polignano a Mare old town terrace" },
            { time: "12:00", title: "Lama Monachile", description: "La celebre caletta tra due falesie sotto il ponte borbonico: la cartolina di Polignano.", category: "sightseeing", estimatedCost: "Gratis", coordinates: { lat: 40.9966, lng: 17.2161 }, photoQuery: "Lama Monachile beach Polignano" },
            { time: "13:30", title: "Pranzo di crudo", description: "Crudo di mare pugliese e spaghetti ai ricci in una terrazza sul blu.", category: "food", estimatedCost: "€22–35", coordinates: { lat: 40.9955, lng: 17.2195 }, photoQuery: "Polignano seafood crudo terrace" },
            { time: "18:30", title: "Aperitivo sulle falesie", description: "Spritz al tramonto con il mare che batte sotto le scogliere del centro.", category: "nightlife", estimatedCost: "€8–14", coordinates: { lat: 40.9962, lng: 17.2200 }, photoQuery: "Polignano cliff aperitivo sunset" },
          ],
        },
        {
          day: 2,
          title: "Monopoli e Alberobello",
          summary: "Un porto antico e il paese dei trulli, patrimonio UNESCO.",
          activities: [
            { time: "09:30", title: "Porto e centro di Monopoli", description: "Barche colorate (gozzi), mura aragonesi e una cattedrale barocca a 10 minuti da Polignano.", category: "sightseeing", estimatedCost: "Gratis", coordinates: { lat: 40.9514, lng: 17.3000 }, photoQuery: "Monopoli port old town Puglia" },
            { time: "12:30", title: "Pranzo a Monopoli", description: "Orecchiette alle cime di rapa e focaccia barese in una trattoria del centro.", category: "food", estimatedCost: "€15–25", coordinates: { lat: 40.9520, lng: 17.2980 }, photoQuery: "orecchiette Puglia trattoria" },
            { time: "15:00", title: "Trulli di Alberobello", description: "Il quartiere Rione Monti: centinaia di trulli coi tetti conici, UNESCO. Magico nel pomeriggio.", category: "experience", estimatedCost: "Gratis", coordinates: { lat: 40.7826, lng: 17.2386 }, photoQuery: "Alberobello trulli Rione Monti" },
            { time: "18:00", title: "Tramonto tra i trulli", description: "Saliscendi tra i vicoli bianchi mentre la luce si addolcisce sui coni di pietra.", category: "sightseeing", estimatedCost: "Gratis", coordinates: { lat: 40.7830, lng: 17.2400 }, photoQuery: "Alberobello trulli sunset" },
          ],
        },
        {
          day: 3,
          title: "Grotte di Castellana e mare",
          summary: "Il mondo sotterraneo della Puglia e un ultimo bagno.",
          activities: [
            { time: "10:00", title: "Grotte di Castellana", description: "Percorso guidato nelle grotte carsiche fino alla bianca Grotta Bianca: scenografico.", category: "experience", estimatedCost: "€16–18", coordinates: { lat: 40.8775, lng: 17.1497 }, photoQuery: "Grotte di Castellana caves Puglia" },
            { time: "13:00", title: "Pranzo in masseria", description: "Antipasti pugliesi, burrata e vino primitivo in una masseria di campagna.", category: "food", estimatedCost: "€20–30", coordinates: { lat: 40.8900, lng: 17.2000 }, photoQuery: "masseria Puglia burrata lunch" },
            { time: "15:30", title: "Bagno a Cala Paura / Cala San Giovanni", description: "Ultimo tuffo nelle calette più tranquille appena fuori Polignano.", category: "sightseeing", estimatedCost: "Gratis", coordinates: { lat: 40.9890, lng: 17.2300 }, photoQuery: "Cala Paura Polignano beach" },
            { time: "18:00", title: "Gelato e saluti", description: "Caffè speciale (con panna e zucchero, alla leccese) o un gelato sul lungomare.", category: "food", estimatedCost: "€3–6", coordinates: { lat: 40.9959, lng: 17.2190 }, photoQuery: "Polignano lungomare gelato" },
          ],
        },
      ],
      packingList: [
        { category: "Abbigliamento", items: ["Costume e telo mare", "Scarpe da scoglio", "Scarpe comode per i borghi", "Felpa leggera per la sera"] },
        { category: "Essenziali", items: ["Crema solare", "Cappello", "Auto a noleggio consigliata", "Borraccia"] },
        { category: "Documenti", items: ["Carta d'identità", "Prenotazione Grotte di Castellana"] },
      ],
    },
  },
];
