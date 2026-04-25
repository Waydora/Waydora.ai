import { ItineraryData, ItineraryActivity, PackingCategory } from "@workspace/api-client-react";
import { Bed, Utensils, Compass, Bus, MapPin, Moon, ExternalLink, Sparkles, CheckSquare, Square } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const categoryIcons = {
  stay: Bed,
  food: Utensils,
  experience: Compass,
  transport: Bus,
  sightseeing: MapPin,
  nightlife: Moon,
};

function ActivityCard({ activity, index }: { activity: ItineraryActivity; index: number }) {
  const Icon = categoryIcons[activity.category] || Sparkles;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.1, 0.5) }}
      className="relative pl-8 pb-8 last:pb-0 group"
    >
      {/* Timeline line */}
      <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border group-last:hidden" />
      
      {/* Timeline dot */}
      <div className="absolute left-0 top-1.5 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center ring-4 ring-background z-10">
        <Icon className="w-4 h-4" />
      </div>

      <Card className="shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                <Badge variant="secondary" className="bg-primary/5 text-primary hover:bg-primary/10">
                  {activity.time}
                </Badge>
                {activity.estimatedCost && (
                  <span className="text-xs border px-2 py-0.5 rounded-full border-border">
                    {activity.estimatedCost}
                  </span>
                )}
              </div>
              <div>
                <h4 className="font-serif text-lg font-bold text-foreground leading-tight">
                  {activity.title}
                </h4>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  {activity.description}
                </p>
              </div>
            </div>
            
            {activity.affiliate && (
              <div className="shrink-0 flex flex-col items-stretch sm:items-end">
                <Button asChild size="sm" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground font-medium shadow-sm">
                  <a href={activity.affiliate.url} target="_blank" rel="noopener noreferrer">
                    {activity.affiliate.label}
                    <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-80" />
                  </a>
                </Button>
                <p className="text-[10px] text-center sm:text-right text-muted-foreground mt-1.5">
                  via {activity.affiliate.provider}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ItineraryTimeline({ itinerary }: { itinerary: ItineraryData }) {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        {itinerary.heroEmoji && (
          <div className="text-6xl mb-4 opacity-90 drop-shadow-sm">{itinerary.heroEmoji}</div>
        )}
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-primary leading-tight">
          {itinerary.title}
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-medium py-2">
          <Badge variant="outline" className="px-3 py-1 bg-background text-foreground">{itinerary.destination}</Badge>
          <Badge variant="outline" className="px-3 py-1 bg-background text-foreground">{itinerary.durationDays} Days</Badge>
          <Badge variant="outline" className="px-3 py-1 bg-background text-foreground">{itinerary.totalBudget}</Badge>
          <Badge variant="outline" className="px-3 py-1 bg-background text-foreground">{itinerary.bestSeason}</Badge>
        </div>
        <p className="text-lg text-muted-foreground italic">"{itinerary.vibe}"</p>
      </div>

      {/* Days */}
      <div className="space-y-12">
        {itinerary.days.map((day, dayIndex) => (
          <div key={day.day} className="relative">
            <div className="sticky top-16 z-20 bg-background/95 backdrop-blur-md py-4 mb-6 border-b border-border/50">
              <div className="flex items-baseline gap-4">
                <h3 className="font-serif text-2xl font-bold text-foreground">
                  Day {day.day}
                </h3>
                <span className="text-muted-foreground font-medium hidden sm:inline">
                  {day.title}
                </span>
              </div>
              <p className="text-sm font-medium text-muted-foreground mt-1 sm:hidden">
                {day.title}
              </p>
              <p className="text-sm text-muted-foreground mt-2 italic border-l-2 border-accent pl-3">
                {day.summary}
              </p>
            </div>
            
            <div className="pl-2">
              {day.activities.map((activity, actIndex) => (
                <ActivityCard 
                  key={`${day.day}-${actIndex}`} 
                  activity={activity} 
                  index={actIndex} 
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PackingList({ list }: { list: PackingCategory[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (catIndex: number, itemIndex: number) => {
    const key = `${catIndex}-${itemIndex}`;
    setChecked(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Card className="border-primary/10 shadow-sm bg-primary/5">
      <CardHeader>
        <CardTitle className="font-serif text-2xl text-primary flex items-center gap-3">
          <CheckSquare className="w-6 h-6 text-accent" />
          Packing List
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {list.map((category, catIndex) => (
            <div key={category.category} className="space-y-4">
              <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                {category.category}
              </h4>
              <ul className="space-y-2.5">
                {category.items.map((item, itemIndex) => {
                  const key = `${catIndex}-${itemIndex}`;
                  const isChecked = checked[key];
                  return (
                    <li 
                      key={itemIndex}
                      className={cn(
                        "flex items-start gap-3 text-sm cursor-pointer group transition-colors",
                        isChecked ? "text-muted-foreground line-through" : "text-foreground font-medium"
                      )}
                      onClick={() => toggle(catIndex, itemIndex)}
                    >
                      <button className="mt-0.5 shrink-0 text-primary/40 group-hover:text-primary transition-colors">
                        {isChecked ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
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
