import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bed,
  Utensils,
  Compass,
  Bus,
  MapPin,
  Moon,
  ExternalLink,
  Sparkles,
  CheckSquare,
  Square,
  Cloud,
  type LucideIcon,
} from "lucide-react";
import type {
  ItineraryData,
  ItineraryActivity,
  PackingCategory,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dayPhoto, pickPhoto } from "@/lib/photos";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  stay: Bed,
  food: Utensils,
  experience: Compass,
  transport: Bus,
  sightseeing: MapPin,
  nightlife: Moon,
};

const CATEGORY_LABEL: Record<string, string> = {
  stay: "Soggiorno",
  food: "Cibo",
  experience: "Esperienza",
  transport: "Trasporto",
  sightseeing: "Visita",
  nightlife: "Nightlife",
};

function ActivityCard({
  activity,
  index,
  destination,
}: {
  activity: ItineraryActivity;
  index: number;
  destination: string;
}) {
  const Icon = CATEGORY_ICON[activity.category] ?? Sparkles;
  const photo = pickPhoto(activity.photoQuery || `${destination} ${activity.title}`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
      className="relative pl-10 pb-6 last:pb-0 group"
    >
      <div className="absolute left-[19px] top-10 bottom-0 w-px bg-border group-last:hidden" />
      <div className="absolute left-1 top-2 w-9 h-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center ring-4 ring-background z-10 shadow-md">
        <Icon className="w-4 h-4" />
      </div>

      <Card className="overflow-hidden border-border/60 bg-card hover:border-accent/40 transition-colors duration-300">
        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr]">
          <div
            className="hidden sm:block bg-cover bg-center min-h-[140px] relative"
            style={{ backgroundImage: `url(${photo.src})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-card/60 to-transparent" />
          </div>
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge className="bg-accent/15 text-accent hover:bg-accent/20 border-0 font-semibold text-xs">
                {activity.time}
              </Badge>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-bold border-border/60 text-muted-foreground">
                {CATEGORY_LABEL[activity.category] ?? activity.category}
              </Badge>
              {activity.estimatedCost && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                  {activity.estimatedCost}
                </span>
              )}
            </div>
            <h4 className="font-serif text-lg font-bold text-foreground leading-tight">
              {activity.title}
            </h4>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {activity.description}
            </p>
            {activity.affiliate && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  asChild
                  size="sm"
                  className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-full"
                >
                  <a href={activity.affiliate.url} target="_blank" rel="noopener noreferrer">
                    {activity.affiliate.label}
                    <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-80" />
                  </a>
                </Button>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  via {activity.affiliate.provider}
                </span>
              </div>
            )}
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );
}

export function ItineraryResults({ itinerary }: { itinerary: ItineraryData }) {
  return (
    <div className="space-y-10">
      <div className="rounded-3xl overflow-hidden border border-border bg-card shadow-xl">
        <div
          className="relative h-44 md:h-56 bg-cover bg-center"
          style={{ backgroundImage: `url(${pickPhoto(itinerary.destination).src})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7 flex items-end gap-4">
            {itinerary.heroEmoji && (
              <div className="text-5xl md:text-6xl drop-shadow-md">{itinerary.heroEmoji}</div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="font-serif text-2xl md:text-4xl font-bold text-white leading-tight drop-shadow">
                {itinerary.title}
              </h2>
              <p className="text-white/90 text-sm md:text-base font-medium mt-1 italic drop-shadow">
                "{itinerary.vibe}"
              </p>
            </div>
          </div>
        </div>
        <div className="p-5 md:p-6 flex flex-wrap gap-2">
          <Badge variant="outline" className="px-3 py-1 bg-background text-foreground border-border/60">
            <MapPin className="w-3 h-3 mr-1.5 text-accent" />
            {itinerary.destination}
          </Badge>
          <Badge variant="outline" className="px-3 py-1 bg-background text-foreground border-border/60">
            {itinerary.durationDays} giorni
          </Badge>
          <Badge variant="outline" className="px-3 py-1 bg-background text-foreground border-border/60">
            {itinerary.totalBudget}
          </Badge>
          <Badge variant="outline" className="px-3 py-1 bg-background text-foreground border-border/60">
            {itinerary.bestSeason}
          </Badge>
        </div>
      </div>

      <div className="space-y-12">
        {itinerary.days.map((day, dayIndex) => {
          const photo = dayPhoto(itinerary.destination, dayIndex, day.title);
          return (
            <div key={day.day} className="relative">
              <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md py-4 mb-5 -mx-4 md:mx-0 px-4 md:px-0 border-b border-border/50">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="flex items-baseline gap-3">
                    <h3 className="font-serif text-xl md:text-2xl font-bold text-foreground">
                      Giorno {day.day}
                    </h3>
                    <span className="text-muted-foreground font-medium text-sm md:text-base">
                      {day.title}
                    </span>
                  </div>
                  {day.weather && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent bg-accent/10 px-3 py-1 rounded-full">
                      <Cloud className="w-3.5 h-3.5" />
                      {day.weather}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2 italic border-l-2 border-accent pl-3">
                  {day.summary}
                </p>
              </div>
              <div
                className="hidden md:block h-32 rounded-2xl bg-cover bg-center mb-6 border border-border/60"
                style={{ backgroundImage: `url(${photo.src})` }}
              />
              <div>
                {day.activities.map((activity, actIndex) => (
                  <ActivityCard
                    key={`${day.day}-${actIndex}`}
                    activity={activity}
                    index={actIndex}
                    destination={itinerary.destination}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PackingList({ list }: { list: PackingCategory[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (catIndex: number, itemIndex: number) => {
    const key = `${catIndex}-${itemIndex}`;
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Card className="border-accent/20 bg-card">
      <CardContent className="p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <CheckSquare className="w-6 h-6 text-accent" />
          <h3 className="font-serif text-2xl font-bold text-foreground">Lista Bagaglio</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {list.map((category, catIndex) => (
            <div key={category.category} className="space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-accent">
                {category.category}
              </h4>
              <ul className="space-y-2">
                {category.items.map((item, itemIndex) => {
                  const key = `${catIndex}-${itemIndex}`;
                  const isChecked = checked[key];
                  return (
                    <li
                      key={itemIndex}
                      className={cn(
                        "flex items-start gap-3 text-sm cursor-pointer group transition-colors",
                        isChecked
                          ? "text-muted-foreground line-through"
                          : "text-foreground font-medium",
                      )}
                      onClick={() => toggle(catIndex, itemIndex)}
                    >
                      <button className="mt-0.5 shrink-0 text-accent/60 group-hover:text-accent transition-colors">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-accent" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <span className="leading-snug">{item}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
