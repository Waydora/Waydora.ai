import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PHOTO_POOL } from "@/lib/photos";

const ROTATE_INTERVAL_MS = 6000;

export function TravelBackdrop({ rotate = true }: { rotate?: boolean }) {
  const [index, setIndex] = useState(() =>
    Math.floor((Date.now() / (1000 * 60 * 60)) % PHOTO_POOL.length),
  );

  useEffect(() => {
    PHOTO_POOL.forEach((p) => {
      const img = new Image();
      img.src = p.src;
    });
  }, []);

  useEffect(() => {
    if (!rotate) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % PHOTO_POOL.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [rotate]);

  const current = PHOTO_POOL[index]!;

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
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.95) 100%)",
        }}
      />
      <div className="absolute bottom-4 right-5 z-10 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.span
            key={current.place}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 0.85, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/85 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm"
          >
            {current.place}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
