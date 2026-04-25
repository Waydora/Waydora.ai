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
];

const KEYWORD_MAP: Array<[RegExp, number]> = [
  [/santorini|grec|atene|mykonos/i, 0],
  [/kyoto|gion/i, 1],
  [/bali|ubud/i, 2],
  [/machu picchu|peru|cusco/i, 3],
  [/island|reykjav|aurora/i, 4],
  [/marocco|marrakech|fes|sahara/i, 5],
  [/nuova zelanda|wanaka|queenstown|new zealand/i, 6],
  [/parig|paris|francia|france|provenza/i, 7],
  [/new york|nyc|manhattan|brooklyn/i, 8],
  [/rom[ae]\b|colosseo|vaticano/i, 9],
  [/amalfi|positano|sorrento|capri|napoli/i, 10],
  [/barcellona|barcelona|catalogna|madrid|spagna/i, 11],
  [/tokyo|shibuya|giappone|osaka|japan/i, 12],
  [/thaila|phi phi|bangkok|phuket/i, 13],
  [/dubai|emirat|abu dhabi/i, 14],
  [/sud africa|cape town|safari|kenya/i, 15],
  [/lisbo|porto|portog/i, 16],
  [/amsterdam|olanda|netherland/i, 17],
];

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function pickPhoto(seed: string): { src: string; place: string } {
  for (const [re, idx] of KEYWORD_MAP) {
    if (re.test(seed)) return PHOTO_POOL[idx]!;
  }
  return PHOTO_POOL[hashSeed(seed) % PHOTO_POOL.length]!;
}

export function dayPhoto(destination: string, dayIndex: number, dayTitle: string): { src: string; place: string } {
  const combined = `${destination} ${dayTitle}`;
  for (const [re, idx] of KEYWORD_MAP) {
    if (re.test(combined)) return PHOTO_POOL[idx]!;
  }
  const seed = `${destination}-${dayIndex}`;
  return PHOTO_POOL[hashSeed(seed) % PHOTO_POOL.length]!;
}
