import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Heart,
  Compass,
  PlusCircle,
  Users,
  Sparkles,
  Map,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import waydoraLogo from "@assets/Travel_simple,_everywhere!_(2)_1777134832372.png";

type SavedTrip = {
  id: string | number;
  shareSlug: string;
  itinerary: { title: string; destination: string; durationDays: number };
};

const NAV_ITEMS = [
  { id: "new",     icon: PlusCircle, label: "Nuova chat",     href: "/",        accent: true  },
  { id: "saved",   icon: Heart,      label: "Viaggi salvati", href: "/saved",   accent: false },
  { id: "explore", icon: Compass,    label: "Esplora",        href: "/explore", accent: false },
  { id: "groups",  icon: Users,      label: "Gruppi vacanza", href: "/groups",  accent: false },
  { id: "create",  icon: Sparkles,   label: "Crea viaggio",   href: "/create",  accent: false },
] as const;

export function GlobalSidebar({
  recentTrips = [],
  isLoadingTrips = false,
}: {
  recentTrips?: SavedTrip[];
  isLoadingTrips?: boolean;
}) {
  const [location, setLocation] = useLocation();
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className={cn(
        "h-full flex flex-col border-r border-border/40 bg-sidebar transition-all duration-200 ease-in-out shrink-0 overflow-hidden z-40",
        expanded ? "w-52" : "w-14",
      )}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-3 border-b border-border/40 shrink-0">
        {expanded ? (
          <Link href="/" onClick={() => window.dispatchEvent(new Event("waydora:reset-home"))}>
            <img src={waydoraLogo} alt="Waydora" className="h-7 w-auto object-contain" />
          </Link>
        ) : (
          <Link href="/" onClick={() => window.dispatchEvent(new Event("waydora:reset-home"))}>
            <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center text-accent-foreground font-bold text-sm shrink-0">
              W
            </div>
          </Link>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5 min-h-0">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          return (
            <Link key={item.id} href={item.href}>
              <button
                className={cn(
                  "w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 overflow-hidden whitespace-nowrap",
                  item.accent
                    ? "bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
                    : isActive
                    ? "bg-sidebar-accent/15 text-sidebar-accent"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground",
                )}
                title={!expanded ? item.label : undefined}
                onClick={() => {
                  if (item.href === "/") window.dispatchEvent(new Event("waydora:reset-home"));
                }}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {expanded && <span className="truncate">{item.label}</span>}
              </button>
            </Link>
          );
        })}

        {/* Recenti */}
        {expanded && (
          <div className="pt-3">
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
              Recenti
            </div>
            {isLoadingTrips ? (
              <div className="flex justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : recentTrips.length > 0 ? (
              recentTrips.slice(0, 5).map((trip) => (
                <button
                  key={trip.id}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-xs text-sidebar-foreground/50 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground transition-colors text-left overflow-hidden"
                  onClick={() => setLocation(`/trip/${trip.shareSlug}`)}
                >
                  <Map className="w-3.5 h-3.5 shrink-0 text-accent/50" />
                  <span className="truncate">{trip.itinerary.destination}</span>
                </button>
              ))
            ) : (
              <p className="px-2 py-1.5 text-xs text-muted-foreground/40 italic">
                Nessun viaggio ancora
              </p>
            )}
          </div>
        )}
      </nav>
    </aside>
  );
}

export function Logo({ variant = "hero" }: { variant?: "hero" | "header" }) {
  if (variant === "header") {
    return (
      <Link href="/" onClick={() => window.dispatchEvent(new Event("waydora:reset-home"))} className="inline-flex items-center group">
        <img src={waydoraLogo} alt="Waydora — Travel simple, everywhere!" className="h-9 md:h-10 w-auto object-contain" />
      </Link>
    );
  }
  return (
    <Link href="/" className="inline-flex flex-col items-center justify-center group">
      <img src={waydoraLogo} alt="Waydora — Travel simple, everywhere!" className="w-[200px] md:w-[300px] h-auto drop-shadow-[0_4px_24px_rgba(0,0,0,0.35)]" />
    </Link>
  );
}

// Layout semplice per pagine legali / trip salvato
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[100dvh] flex flex-col relative selection:bg-accent/20">
      <main className="flex-1 min-h-0 flex flex-col">{children}</main>
    </div>
  );
}

// Layout con sidebar globale — usato nella Home/Chat
export function AppLayout({
  children,
  recentTrips,
  isLoadingTrips,
}: {
  children: React.ReactNode;
  recentTrips?: SavedTrip[];
  isLoadingTrips?: boolean;
}) {
  return (
    <div className="h-[100dvh] flex relative selection:bg-accent/20">
      <div className="hidden lg:flex h-full">
        <GlobalSidebar recentTrips={recentTrips} isLoadingTrips={isLoadingTrips} />
      </div>
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}