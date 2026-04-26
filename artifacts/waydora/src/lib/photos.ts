const BASE = import.meta.env.BASE_URL;

export const PHOTO_POOL = [
  { src: `${BASE}bg/bg-1.jpg`, place: "Santorini · Grecia" },
  { src: `${BASE}bg/bg-2.jpg`, place: "Kyoto · Giappone" },
  { src: `${BASE}bg/bg-3.jpg`, place: "Ubud · Bali" },
  { src: `${BASE}bg/bg-4.jpg`, place: "Machu Picchu · Perù" },
  { src: `${BASE}bg/bg-5.jpg`, place: "Vík · Islanda" },
  { src: `${BASE}bg/bg-7.jpg`, place: "Marrakech · Marocco" },
  { src: `${BASE}bg/bg-8.jpg`, place: "Wanaka · Nuova Zelanda" },
  { src: `${BASE}bg/bg-10.jpg`, place: "Parigi · Francia" },
  { src: `${BASE}bg/bg-11.jpg`, place: "New York · USA" },
  { src: `${BASE}bg/bg-12.jpg`, place: "Roma · Italia" },
  { src: `${BASE}bg/bg-13.jpg`, place: "Costiera Amalfitana · Italia" },
  { src: `${BASE}bg/bg-14.jpg`, place: "Barcellona · Spagna" },
  { src: `${BASE}bg/bg-15.jpg`, place: "Tokyo · Giappone" },
  { src: `${BASE}bg/bg-16.jpg`, place: "Phi Phi · Thailandia" },
  { src: `${BASE}bg/bg-18.jpg`, place: "Dubai · Emirati" },
  { src: `${BASE}bg/bg-19.jpg`, place: "Cape Town · Sud Africa" },
  { src: `${BASE}bg/bg-20.jpg`, place: "Lisbona · Portogallo" },
  { src: `${BASE}bg/bg-21.jpg`, place: "Amsterdam · Olanda" },
  { src: `${BASE}bg/bg-22.jpg`, place: "Napoli · Italia" },
  { src: `${BASE}bg/bg-23.jpg`, place: "Venezia · Italia" },
  { src: `${BASE}bg/bg-24.jpg`, place: "Firenze · Italia" },
  { src: `${BASE}bg/bg-25.jpg`, place: "Milano · Italia" },
  { src: `${BASE}bg/bg-26.jpg`, place: "Londra · UK" },
  { src: `${BASE}bg/bg-27.jpg`, place: "Berlino · Germania" },
  { src: `${BASE}bg/bg-28.jpg`, place: "Praga · Repubblica Ceca" },
  { src: `${BASE}bg/bg-29.jpg`, place: "Vienna · Austria" },
  { src: `${BASE}bg/bg-30.jpg`, place: "Sydney · Australia" },
  { src: `${BASE}bg/bg-31.jpg`, place: "Edimburgo · Scozia" },
];

const KEYWORD_MAP: Array<[RegExp, number]> = [
  // Italian cities — order matters: more specific first
  [/napoli|naples|vesuvi|pompei|ercolano/i, 18],
  [/venezi|venice|murano|burano/i, 19],
  [/firenze|florence|toscana|tuscany|chianti/i, 20],
  [/milano\b|milan\b|navigli|brera/i, 21],
  [/amalfi|positano|sorrento|capri|cetara|ravello|costiera/i, 10],
  [/rom[ae]\b|colosseo|vaticano|trastevere|trevi/i, 9],
  // Other European
  [/londr|london|westminster|notting hill|camden|soho/i, 22],
  [/berlin|brandenburg|kreuzberg/i, 23],
  [/prag[ah]|prague|karluv|vltava/i, 24],
  [/vienn[ae]|wien|schonbrunn/i, 25],
  [/edimburgo|edinburgh|scozia|scotland|highland/i, 27],
  [/parig|paris|francia|france|provenza|montmartre|louvre/i, 7],
  [/barcellona|barcelona|catalogna|gaudi|sagrada/i, 11],
  [/madrid|spagna(?!.*barcellona)/i, 11],
  [/lisbo|porto\b|portog|alfama|sintra/i, 16],
  [/amsterdam|olanda|netherland/i, 17],
  // Mediterranean / Greek
  [/santorini|grec|atene|mykonos|cretan|creta/i, 0],
  // Asia
  [/kyoto|gion|nara/i, 1],
  [/tokyo|shibuya|giappone|osaka|japan/i, 12],
  [/bali|ubud|seminyak|canggu/i, 2],
  [/thaila|phi phi|bangkok|phuket|chiang mai/i, 13],
  // Americas
  [/machu picchu|peru|cusco|lima/i, 3],
  [/new york|nyc|manhattan|brooklyn|times square/i, 8],
  // Africa & Middle East
  [/marocco|marrakech|fes|sahara|chefchaouen/i, 5],
  [/dubai|emirat|abu dhabi/i, 14],
  [/sud africa|cape town|safari|kenya/i, 15],
  // Pacific
  [/nuova zelanda|wanaka|queenstown|new zealand|milford/i, 6],
  [/sydney|australia|melbourne|opera house/i, 26],
  // Nordic
  [/island|reykjav|aurora|fjord|norvegia|norway/i, 4],
];

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function matchByKeyword(text: string): number | null {
  for (const [re, idx] of KEYWORD_MAP) {
    if (re.test(text)) return idx;
  }
  return null;
}

export function pickPhoto(
  seed: string,
  destination?: string,
): { src: string; place: string } {
  const direct = matchByKeyword(seed);
  if (direct !== null) return PHOTO_POOL[direct]!;
  if (destination) {
    const fromDest = matchByKeyword(destination);
    if (fromDest !== null) return PHOTO_POOL[fromDest]!;
  }
  const seedFull = destination ? `${destination}-${seed}` : seed;
  return PHOTO_POOL[hashSeed(seedFull) % PHOTO_POOL.length]!;
}

export function dayPhoto(
  destination: string,
  dayIndex: number,
  dayTitle: string,
): { src: string; place: string } {
  const combined = `${destination} ${dayTitle}`;
  const direct = matchByKeyword(combined);
  if (direct !== null) return PHOTO_POOL[direct]!;
  const fromDest = matchByKeyword(destination);
  if (fromDest !== null) return PHOTO_POOL[fromDest]!;
  return PHOTO_POOL[hashSeed(`${destination}-${dayIndex}`) % PHOTO_POOL.length]!;
}
