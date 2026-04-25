import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const BASE = import.meta.env.BASE_URL;

const PHOTOS = [
  { src: `${BASE}bg/bg-1.jpg`, place: "Santorini · Greece" },
  { src: `${BASE}bg/bg-2.jpg`, place: "Kyoto · Japan" },
  { src: `${BASE}bg/bg-3.jpg`, place: "Ubud · Bali" },
  { src: `${BASE}bg/bg-4.jpg`, place: "Machu Picchu · Peru" },
  { src: `${BASE}bg/bg-5.jpg`, place: "Vík · Iceland" },
  { src: `${BASE}bg/bg-7.jpg`, place: "Marrakech · Morocco" },
  { src: `${BASE}bg/bg-8.jpg`, place: "Wanaka · New Zealand" },
];

export function TravelBackdrop() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    PHOTOS.forEach((p) => {
      const img = new Image();
      img.src = p.src;
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % PHOTOS.length);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  const current = PHOTOS[index]!;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <AnimatePresence mode="sync">
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 1.6 }, scale: { duration: 7, ease: "linear" } }}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${current.src})` }}
        />
      </AnimatePresence>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(5,34,50,0.55) 0%, rgba(5,34,50,0.65) 50%, rgba(5,34,50,0.85) 100%)",
        }}
      />
      <div className="absolute bottom-4 right-5 z-10">
        <AnimatePresence mode="wait">
          <motion.span
            key={current.place}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 0.8, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/80 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm"
          >
            {current.place}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
