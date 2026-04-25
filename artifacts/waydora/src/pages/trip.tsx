import { useEffect } from "react";
import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { ItineraryTimeline, PackingList } from "@/components/itinerary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Share2, Copy, Map, Mail } from "lucide-react";
import { useGetSharedItinerary, getGetSharedItineraryQueryKey } from "@workspace/api-client-react";

export default function Trip() {
  const params = useParams();
  const slug = params.slug || "";
  
  const { data: saved, isLoading, error } = useGetSharedItinerary(slug, {
    query: {
      enabled: !!slug,
      queryKey: getGetSharedItineraryQueryKey(slug)
    }
  });
  
  const { toast } = useToast();

  useEffect(() => {
    if (saved?.itinerary) {
      document.title = `${saved.itinerary.destination} — Waydora`;
    }
  }, [saved]);

  const shareUrl = typeof window !== "undefined" 
    ? `${window.location.origin}${import.meta.env.BASE_URL}trip/${slug}`
    : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Link copied!",
      description: "You can now paste and share it with friends.",
    });
  };

  const handleMailShare = () => {
    if (!saved) return;
    const subject = `Check out this trip to ${saved.itinerary.destination}`;
    const body = `I planned a trip to ${saved.itinerary.destination} with Waydora.\n\nCheck out the itinerary here: ${shareUrl}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const handleWhatsAppShare = () => {
    if (!saved) return;
    const text = `Check out this trip to ${saved.itinerary.destination} I planned with Waydora: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
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
          <h2 className="text-3xl font-serif font-bold text-foreground">Trip not found</h2>
          <p className="text-lg text-muted-foreground max-w-md">
            We couldn't find this itinerary. The link might be broken or the trip was deleted.
          </p>
          <Button asChild size="lg" className="mt-8 rounded-full px-8">
            <Link href="/">Back to Planner</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const { itinerary } = saved;

  return (
    <Layout>
      <div className="flex-1 bg-background pb-24">
        {/* Top Actions */}
        <div className="sticky top-16 z-40 bg-background/90 backdrop-blur-xl border-b border-border/50 shadow-sm">
          <div className="container max-w-4xl mx-auto py-4 px-4 flex items-center justify-between">
            <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground hover:text-foreground font-medium">
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Planner
              </Link>
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleCopyLink} className="gap-2 bg-background font-medium shadow-sm">
                <Copy className="w-4 h-4 text-primary" />
                <span className="hidden sm:inline">Copy Link</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="container max-w-4xl mx-auto py-10 px-4 md:py-16 space-y-20">
          <ItineraryTimeline itinerary={itinerary} />
          
          <div className="border-t border-border pt-16">
            <PackingList list={itinerary.packingList} />
          </div>

          <div className="border-t border-border pt-16">
            <Card className="bg-primary/5 border-primary/10 overflow-hidden shadow-lg">
              <CardContent className="p-8 sm:p-12 flex flex-col items-center text-center space-y-8">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2 ring-8 ring-background">
                  <Share2 className="w-10 h-10" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-3xl font-serif font-bold text-foreground">Share this trip</h3>
                  <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Send this itinerary to your travel buddies and start packing.
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row w-full max-w-lg gap-3">
                  <div className="flex-1 flex items-center px-5 py-4 bg-background border rounded-xl text-sm font-medium text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap shadow-sm">
                    {shareUrl}
                  </div>
                  <Button size="lg" onClick={handleCopyLink} className="shrink-0 py-7 rounded-xl font-bold shadow-md">
                    <Copy className="w-5 h-5 mr-2" />
                    Copy Link
                  </Button>
                </div>
                
                <div className="flex flex-wrap items-center justify-center gap-4 pt-6">
                  <Button variant="outline" size="lg" className="rounded-full gap-3 px-8 font-semibold shadow-sm bg-background" onClick={handleMailShare}>
                    <Mail className="w-5 h-5" /> Email
                  </Button>
                  <Button variant="outline" size="lg" className="rounded-full gap-3 px-8 font-semibold shadow-sm border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10 bg-background" onClick={handleWhatsAppShare}>
                    WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
