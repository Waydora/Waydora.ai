import { useEffect, useMemo, useRef } from "react";

// Tipo strutturale minimo: TripMap legge solo i giorni e le loro attività con
// coordinate. Volutamente più permissivo di ItineraryData (hooks/api.ts) per
// accettare sia l'itinerario salvato sia l'anteprima del create-trip editor,
// che porta campi extra (es. tripPhotos) e attività senza coordinate.
type MapActivity = {
  title: string;
  time: string;
  category: string;
  coordinates?: { lat: number; lng: number } | null;
};
type MapDay = {
  day: number;
  activities: MapActivity[];
};
type ItineraryData = {
  days: MapDay[];
};

const DAY_COLORS = [
  "#FF8C42", "#3B82F6", "#10B981", "#F59E0B",
  "#8B5CF6", "#EF4444", "#06B6D4", "#EC4899",
  "#84CC16", "#F97316",
];

function getDayColor(dayIndex: number): string {
  return DAY_COLORS[dayIndex % DAY_COLORS.length]!;
}

type MarkerData = {
  key: string; lat: number; lng: number;
  day: number; dayIndex: number;
  title: string; time: string; category: string;
};

// Rileva se siamo su mobile (viewport < 1024px)
function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth < 1024;
}

export function TripMap({ itinerary }: { itinerary: ItineraryData }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  const { markers, polylinesByDay } = useMemo(() => {
    const out: MarkerData[] = [];
    const byDay: Record<number, google.maps.LatLngLiteral[]> = {};

    itinerary.days.forEach((day: MapDay, dayIndex: number) => {
      let actIdx = 0;
      const dayPoints: google.maps.LatLngLiteral[] = [];
      for (const a of day.activities) {
        actIdx++;
        if (a.coordinates?.lat && a.coordinates?.lng) {
          out.push({
            key: `${day.day}-${actIdx}`,
            lat: a.coordinates.lat, lng: a.coordinates.lng,
            day: day.day, dayIndex,
            title: a.title, time: a.time, category: a.category,
          });
          dayPoints.push({ lat: a.coordinates.lat, lng: a.coordinates.lng });
        }
      }
      if (dayPoints.length > 1) byDay[dayIndex] = dayPoints;
    });

    return { markers: out, polylinesByDay: byDay };
  }, [itinerary]);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
    if (!apiKey || !mapRef.current) return;

    const mobile = isMobileViewport();

    const loadMap = () => {
      if (!mapRef.current) return;

      const center = markers.length > 0
        ? { lat: markers[0]!.lat, lng: markers[0]!.lng }
        : { lat: 41.9028, lng: 12.4964 };

      googleMapRef.current = new google.maps.Map(mapRef.current, {
        center,
        zoom: 10,
        mapTypeId: "roadmap",

        // Su mobile: greedy = un dito per muovere la mappa, nessuno zoom controls
        gestureHandling: mobile ? "greedy" : "cooperative",
        zoomControl: !mobile,          // ← nasconde + e - su mobile
        zoomControlOptions: mobile ? undefined : {
          position: google.maps.ControlPosition.RIGHT_BOTTOM,
        },

        clickableIcons: false,
        keyboardShortcuts: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,

        styles: [
          { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
        ],
      });

      // Pulisci vecchi marker e polyline
      markersRef.current.forEach(m => m.setMap(null));
      polylinesRef.current.forEach(p => p.setMap(null));
      markersRef.current = [];
      polylinesRef.current = [];

      const bounds = new google.maps.LatLngBounds();

      // Marker
      markers.forEach((m) => {
        const color = getDayColor(m.dayIndex);
        const marker = new google.maps.Marker({
          position: { lat: m.lat, lng: m.lng },
          map: googleMapRef.current!,
          title: m.title,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
          label: {
            text: String(m.day),
            color: "#ffffff",
            fontSize: "11px",
            fontWeight: "bold",
          },
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="font-family:Inter,sans-serif;padding:4px 2px;min-width:150px">
              <div style="font-size:10px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">
                Giorno ${m.day} · ${m.time}
              </div>
              <div style="font-size:14px;font-weight:700;color:#0f172a">${m.title}</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px">${m.category}</div>
            </div>
          `,
        });

        marker.addListener("click", () => {
          infoWindow.open(googleMapRef.current!, marker);
        });

        markersRef.current.push(marker);
        bounds.extend({ lat: m.lat, lng: m.lng });
      });

      // Route reali Google Directions
      Object.entries(polylinesByDay).forEach(([dayIdx, points]) => {
        if (points.length < 2) return;

        const directionsService  = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({
          suppressMarkers: true,
          preserveViewport: true,
          polylineOptions: {
            strokeColor: getDayColor(Number(dayIdx)),
            strokeOpacity: 0.75,
            strokeWeight: 5,
          },
        });

        directionsRenderer.setMap(googleMapRef.current!);

        const origin      = points[0];
        const destination = points[points.length - 1];
        const waypoints   = points.slice(1, -1).map(p => ({ location: p, stopover: true }));

        directionsService.route(
          { origin, destination, waypoints, optimizeWaypoints: true, travelMode: google.maps.TravelMode.WALKING },
          (result, status) => {
            if (status === "OK" && result) directionsRenderer.setDirections(result);
          }
        );
      });

      // Fit bounds
      if (markers.length > 1) {
        googleMapRef.current.fitBounds(bounds, 80);
      }
    };

    if (window.google?.maps) {
      loadMap();
    } else {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&language=it`;
      script.async = true;
      script.onload = loadMap;
      document.head.appendChild(script);
    }
  }, [markers, polylinesByDay]);

  if (markers.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground bg-card/40">
        <div className="text-4xl mb-3 opacity-50">🗺️</div>
        <p className="text-sm font-medium max-w-xs">La mappa apparirà qui quando l'itinerario avrà coordinate.</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      <div ref={mapRef} className="h-full w-full" />

      {/* Legenda giorni */}
      {itinerary.days.length > 1 && (
        <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl p-2.5 shadow-lg max-w-[160px]">
          <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">Legenda</div>
          <div className="space-y-1">
            {itinerary.days.slice(0, 7).map((day: MapDay, i: number) => (
              <div key={day.day} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getDayColor(i) }} />
                <span className="text-[11px] font-medium text-gray-700 truncate">Giorno {day.day}</span>
              </div>
            ))}
            {itinerary.days.length > 7 && (
              <div className="text-[10px] text-gray-400 pt-0.5">+{itinerary.days.length - 7} altri...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}