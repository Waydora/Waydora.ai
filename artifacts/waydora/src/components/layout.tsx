import { Link, useLocation } from "wouter";
import { Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import waydoraLogo from "@assets/Travel_simple,_everywhere!_(2)_1777134832372.png";

export function Logo({ variant = "hero" }: { variant?: "hero" | "header" }) {
  if (variant === "header") {
    return (
      <Link
        href="/"
        className="inline-flex items-center group"
        onClick={() => {
          window.dispatchEvent(new Event("waydora:reset-home"));
        }}
      >
        <img
          src={waydoraLogo}
          alt="Waydora — Travel simple, everywhere!"
          className="h-9 md:h-10 w-auto object-contain"
        />
      </Link>
    );
  }
  return (
    <Link href="/" className="inline-flex flex-col items-center justify-center group">
      <img
        src={waydoraLogo}
        alt="Waydora — Travel simple, everywhere!"
        className="w-[200px] md:w-[300px] h-auto drop-shadow-[0_4px_24px_rgba(0,0,0,0.35)]"
      />
    </Link>
  );
}

export function Header() {
const itineraries: any[] = [];
const isLoading = false;
  const [, setLocation] = useLocation();

  return (
    <header className="shrink-0 sticky top-0 z-50 w-full border-b border-white/10 bg-black/95 backdrop-blur-md">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        <Logo variant="header" />

        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 font-medium text-white hover:bg-white/10 hover:text-white"
              >
                <Heart className="w-4 h-4 text-accent fill-accent" />
                <span className="hidden sm:inline">I miei viaggi</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>I tuoi itinerari</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isLoading ? (
                <div className="p-4 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : itineraries?.length ? (
                itineraries.map((saved) => (
                  <DropdownMenuItem
                    key={saved.id}
                    className="cursor-pointer flex flex-col items-start gap-1 p-3"
                    onClick={() => setLocation(`/trip/${saved.shareSlug}`)}
                  >
                    <span className="font-medium line-clamp-1 text-foreground">{saved.itinerary.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {saved.itinerary.destination} • {saved.itinerary.durationDays} giorni
                    </span>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nessun viaggio salvato.
                  <br />
                  Inizia a chattare per crearne uno!
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[100dvh] flex flex-col relative selection:bg-accent/20">
      <Header />
      <main className="flex-1 min-h-0 flex flex-col">{children}</main>
    </div>
  );
}
