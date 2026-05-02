import { useEffect } from "react";
import { useParams, Link } from "wouter";
import { Loader2, ArrowLeft, Share2, Copy, Map, Mail } from "lucide-react";
import { Layout } from "@/components/layout";
import { ItineraryResults, PackingList } from "@/components/itinerary-results";
import { TripMap } from "@/components/trip-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

import { useQuery } from "@tanstack/react-query";

export default function Trip() {
  const params = useParams();
  const slug = params.slug || "";

const {
  data: saved,
  isLoading,
  error,
} = useQuery({
  queryKey: ["trip", slug],
  enabled: !!slug,
  queryFn: async () => {
    const response = await fetch(`/api/trip/${slug}`);

    if (!response.ok) {
      throw new Error("Trip non trovato");
    }

    return response.json();
  },
});

  const { toast } = useToast();

  useEffect(() => {
    if (saved?.itinerary) {
      document.title = `${saved.itinerary.destination} — Waydora`;
    }
  }, [saved]);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${import.meta.env.BASE_URL}trip/${slug}`
      : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Link copiato!", description: "Ora puoi incollarlo e condividerlo." });
  };

  const handleMailShare = () => {
    if (!saved) return;
    const subject = `Guarda questo viaggio a ${saved.itinerary.destination}`;
    const body = `Ho pianificato un viaggio a ${saved.itinerary.destination} con Waydora.\n\nGuarda l'itinerario qui: ${shareUrl}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const handleWhatsAppShare = () => {
    if (!saved) return;
    const text = `Guarda questo viaggio a ${saved.itinerary.destination} pianificato con Waydora: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-accent" />
        </div>
      </Layout>
    );
  }

  if (error || !saved) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
          <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center">
            <Map className="w-12 h-12 text-muted-foreground" />
          </div>
          <h2 className="text-3xl font-serif font-bold text-foreground">Viaggio non trovato</h2>
          <p className="text-lg text-muted-foreground max-w-md">
            Non abbiamo trovato questo itinerario. Il link potrebbe essere rotto o il viaggio è stato eliminato.
          </p>
          <Button asChild size="lg" className="mt-4 rounded-full px-8">
            <Link href="/">Torna alla home</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const { itinerary } = saved;

  const ShareCard = (
    <Card className="bg-accent/5 border-accent/30">
      <CardContent className="p-6 md:p-8 flex flex-col items-center text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center text-accent ring-8 ring-background">
          <Share2 className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-serif font-bold text-foreground">Condividi questo viaggio</h3>
          <p className="text-base text-muted-foreground max-w-md mx-auto">
            Manda l'itinerario ai compagni di viaggio e cominciate a fare le valigie.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row w-full max-w-lg gap-2">
          <div className="flex-1 flex items-center px-4 py-3 bg-background border border-border/60 rounded-xl text-sm font-medium text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
            {shareUrl}
          </div>
          <Button onClick={handleCopyLink} className="shrink-0 py-5 rounded-xl font-bold bg-accent hover:bg-accent/90 text-accent-foreground">
            <Copy className="w-4 h-4 mr-2" />
            Copia link
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="sm" className="rounded-full gap-2 px-5 font-semibold bg-background" onClick={handleMailShare}>
            <Mail className="w-4 h-4" /> Email
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full gap-2 px-5 font-semibold border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10 bg-background"
            onClick={handleWhatsAppShare}
          >
            WhatsApp
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Layout>
      <div className="flex-1 min-h-0 hidden lg:grid lg:grid-cols-[minmax(0,1fr)_460px]">
        <section className="min-h-0 flex flex-col">
          <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/40 px-6 py-3 flex items-center justify-between">
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground font-medium">
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Pianificatore
              </Link>
            </Button>
            <Button size="sm" onClick={handleCopyLink} className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2 rounded-full font-semibold">
              <Copy className="w-4 h-4" />
              Copia link
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-10 pb-16">
              <ItineraryResults itinerary={itinerary} />
              <PackingList list={itinerary.packingList} />
              {ShareCard}
            </div>
          </div>
        </section>
        <aside className="border-l border-border/40 min-h-0 flex flex-col">
          <div className="px-5 py-4 border-b border-border/40 bg-card/40 backdrop-blur">
            <span className="text-sm font-bold uppercase tracking-wider">Mappa</span>
          </div>
          <div className="flex-1 min-h-0">
            <TripMap itinerary={itinerary} />
          </div>
        </aside>
      </div>

      <div className="flex-1 min-h-0 lg:hidden flex flex-col">
        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between bg-background/95 backdrop-blur">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Home
            </Link>
          </Button>
          <Button size="sm" onClick={handleCopyLink} className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5 rounded-full text-xs">
            <Copy className="w-3.5 h-3.5" />
            Copia
          </Button>
        </div>
        <Tabs defaultValue="trip" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-3 mt-3 grid grid-cols-2 bg-secondary/60">
            <TabsTrigger value="trip" className="text-xs font-semibold">Itinerario</TabsTrigger>
            <TabsTrigger value="map" className="text-xs font-semibold">Mappa</TabsTrigger>
          </TabsList>
          <TabsContent value="trip" className="flex-1 min-h-0 mt-2">
            <div className="h-full overflow-y-auto p-4 space-y-8 pb-24">
              <ItineraryResults itinerary={itinerary} />
              <PackingList list={itinerary.packingList} />
              {ShareCard}
            </div>
          </TabsContent>
          <TabsContent value="map" className="flex-1 min-h-0 mt-2">
            <div className="h-full">
              <TripMap itinerary={itinerary} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
