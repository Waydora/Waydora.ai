import { MapPin, CalendarDays, Users, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TripFilters = {
  where: string;
  when: string;
  travelers: string;
  budget: string;
};

export const EMPTY_FILTERS: TripFilters = {
  where: "",
  when: "",
  travelers: "2",
  budget: "Medio",
};

export function filtersToPromptPrefix(f: TripFilters): string {
  const parts: string[] = [];
  if (f.where.trim()) parts.push(`Destinazione: ${f.where.trim()}`);
  if (f.when.trim()) parts.push(`Periodo: ${f.when.trim()}`);
  if (f.travelers && f.travelers !== "0") parts.push(`Viaggiatori: ${f.travelers}`);
  if (f.budget) parts.push(`Budget: ${f.budget}`);
  return parts.length ? `[${parts.join(" · ")}] ` : "";
}

export function FilterBar({
  value,
  onChange,
}: {
  value: TripFilters;
  onChange: (next: TripFilters) => void;
}) {
  const set = (patch: Partial<TripFilters>) => onChange({ ...value, ...patch });

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-2 bg-card/60 border border-border/60 rounded-2xl backdrop-blur-md">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-background/60 rounded-xl border border-border/40">
        <MapPin className="w-4 h-4 text-accent shrink-0" />
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Dove</span>
          <Input
            value={value.where}
            onChange={(e) => set({ where: e.target.value })}
            placeholder="Lisbona, Tokyo..."
            className="h-6 px-0 border-0 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 shadow-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5 bg-background/60 rounded-xl border border-border/40">
        <CalendarDays className="w-4 h-4 text-accent shrink-0" />
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Quando</span>
          <Input
            value={value.when}
            onChange={(e) => set({ when: e.target.value })}
            placeholder="Giugno, weekend..."
            className="h-6 px-0 border-0 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 shadow-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5 bg-background/60 rounded-xl border border-border/40">
        <Users className="w-4 h-4 text-accent shrink-0" />
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Viaggiatori</span>
          <Select value={value.travelers} onValueChange={(v) => set({ travelers: v })}>
            <SelectTrigger className="h-6 px-0 border-0 bg-transparent text-sm font-medium text-foreground focus:ring-0 shadow-none [&>svg]:hidden">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 persona</SelectItem>
              <SelectItem value="2">2 persone</SelectItem>
              <SelectItem value="3">3 persone</SelectItem>
              <SelectItem value="4">4 persone</SelectItem>
              <SelectItem value="5+">5+ persone</SelectItem>
              <SelectItem value="Famiglia con bambini">Famiglia con bambini</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5 bg-background/60 rounded-xl border border-border/40">
        <Wallet className="w-4 h-4 text-accent shrink-0" />
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Budget</span>
          <Select value={value.budget} onValueChange={(v) => set({ budget: v })}>
            <SelectTrigger className="h-6 px-0 border-0 bg-transparent text-sm font-medium text-foreground focus:ring-0 shadow-none [&>svg]:hidden">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Basso">Basso (€)</SelectItem>
              <SelectItem value="Medio">Medio (€€)</SelectItem>
              <SelectItem value="Alto">Alto (€€€)</SelectItem>
              <SelectItem value="Lusso">Lusso (€€€€)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
