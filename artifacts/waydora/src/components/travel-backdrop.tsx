import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchPhoto } from "@/lib/photos";

const destinations = [
  "Lisbon Portugal",
  "Tokyo Japan",
  "Bali Indonesia",
  "New York USA",
  "Paris France",
];

const ROTATE_INTERVAL_MS = 6000;

export function TravelBackdrop() {
  const [index, setIndex] = useState(0);
  const [photo, setPhoto] = useState("");

  useEffect(() => {
    fetchPhoto(destinations[index]).then(setPhoto);

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % destinations.length);
    }, ROTATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [index]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={photo}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${photo})`,
          }}
        />
      </AnimatePresence>

      <div className="absolute inset-0 bg-black/50" />
    </div>
  );
}