import { Link, useLocation } from "wouter";
import { Map, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useListItineraries } from "@workspace/api-client-react";

export function Logo() {
  return (
    <div className="flex flex-col items-center justify-center">
      <Link href="/" className="inline-flex items-center gap-2 group">
        <span className="font-serif text-4xl md:text-5xl font-bold tracking-tight text-primary">
          Waydora<span className="text-accent">.</span>
        </span>
      </Link>
      <p className="text-base font-medium text-muted-foreground mt-2 tracking-wide">
        Travel simple, everywhere!
      </p>
    </div>
  );
}

export function Header() {
  const { data: itineraries, isLoading } = useListItineraries();
  const [, setLocation] = useLocation();

  return (
    <header className="shrink-0 sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1 group">
          <span className="font-serif text-xl font-bold text-primary">
            Waydora<span className="text-accent">.</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 font-medium">
                <Map className="w-4 h-4 text-accent" />
                <span className="hidden sm:inline">Saved Trips</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Your Itineraries</DropdownMenuLabel>
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
                      {saved.itinerary.destination} • {saved.itinerary.durationDays} days
                    </span>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No saved trips yet.
                  <br />
                  Start chatting to create one!
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
