import { useEffect, useMemo, useRef } from "react";

// Tipo strutturale minimo: TripMap legge solo i giorni e le loro attività con
// coordinate. Volutamente più permissivo di ItineraryData (hooks/api.ts) per
// accettare sia l'itinerario salvato sia l'anteprima del create-trip editor,
// che porta campi extra (es. tripPhotos) e attività senza coordinate.
type MapActivity = {
  title: string;
  time: string;
  category: string;
  transportMode?: string | null;
  coordinates?: { lat: number; lng: number } | null;
};
type MapDay = {
  day: number;
  city?: string | null;
  activities: MapActivity[];
};
type ItineraryData = {
  days: MapDay[];
  departure?: string | null;
  departureCoords?: { lat: number; lng: number } | null;
};

// Mezzi su strada → Google Directions traccia il percorso REALE. Il traghetto è qui
// perché un viaggio auto+traghetto (es. Bari→Patrasso) viene reso da Google come un
// percorso continuo che include la tratta marittima. Per i traghetti tra isole senza
// strade, Directions non trova rotta → fallback automatico a linea tratteggiata.
const ROAD_MODES = ["car", "taxi", "bus", "ferry"];
// Mezzi non guidabili (in linea d'aria / su rotaia) → linea tratteggiata diretta.
const DASHED_MODES = ["flight", "train"];
const CONNECTOR_COLOR = "#334155"; // slate-700, distinto dalle route a piedi colorate per giorno

type Connector = {
  from: google.maps.LatLngLiteral;
  to: google.maps.LatLngLiteral;
  mode: "road" | "dashed";
};

const DAY_COLORS = [
  "#FF8C42", "#3B82F6", "#10B981", "#F59E0B",
  "#8B5CF6", "#EF4444", "#06B6D4", "#EC4899",
  "#84CC16", "#F97316",
];

function getDayColor(dayIndex: number): string {
  return DAY_COLORS[dayIndex % DAY_COLORS.length]!;
}

// Distanza in km tra due coordinate (Haversine) — decide auto vs aereo quando
// il mezzo non è esplicito.
function haversineKm(a: google.maps.LatLngLiteral, b: google.maps.LatLngLiteral): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type MarkerData = {
  key: string; lat: number; lng: number;
  day: number; dayIndex: number; seq: number;
  title: string; time: string; category: string;
};

// Rileva un dispositivo touch (non la larghezza viewport): su un laptop 13-15"
// con scaling Windows la larghezza CSS scende sotto 1024px pur essendo desktop,
// e i controlli zoom sparivano. Su touch usiamo gesture "greedy" e niente zoom UI;
// su non-touch (qualsiasi desktop) mostriamo sempre i controlli zoom.
function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)").matches
    || "ontouchstart" in window
    || navigator.maxTouchPoints > 0;
}

export function TripMap({ itinerary }: { itinerary: ItineraryData }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  const { markers, polylinesByDay, connectors } = useMemo(() => {
    const out: MarkerData[] = [];
    const byDay: Record<number, google.maps.LatLngLiteral[]> = {};
    // Anagrafica per-giorno per costruire i collegamenti tra città/tappe.
    const dayInfo: { first: google.maps.LatLngLiteral; last: google.maps.LatLngLiteral; city: string; mode: string | null }[] = [];

    itinerary.days.forEach((day: MapDay, dayIndex: number) => {
      // seq = numero progressivo delle tappe EFFETTIVAMENTE mappate del giorno, in
      // ordine cronologico (le attività arrivano già ordinate mattino→sera). Così il
      // marker mostra 1,2,3… per le tappe del giorno (non il numero del giorno ripetuto);
      // il COLORE resta quello del giorno per distinguerli a colpo d'occhio.
      let seq = 0;
      const dayPoints: google.maps.LatLngLiteral[] = [];
      // Raccoglie TUTTI i mezzi dichiarati nel giorno; il mezzo del connettore tra
      // città viene poi scelto per PRIORITÀ (sotto). Così un giorno con "auto fino
      // all'aeroporto + volo" usa il VOLO per la tratta lunga (non l'auto locale),
      // mentre un giorno con "auto + traghetto" usa il traghetto (percorso reale).
      const dayModes = new Set<string>();
      for (const a of day.activities) {
        if ((a.category || "").toLowerCase() === "transport" && a.transportMode) {
          dayModes.add(a.transportMode.toLowerCase());
        }
        if (a.coordinates?.lat && a.coordinates?.lng) {
          seq++;
          out.push({
            key: `${day.day}-${seq}`,
            lat: a.coordinates.lat, lng: a.coordinates.lng,
            day: day.day, dayIndex, seq,
            title: a.title, time: a.time, category: a.category,
          });
          dayPoints.push({ lat: a.coordinates.lat, lng: a.coordinates.lng });
        }
      }
      // Priorità: volo > treno > traghetto > auto > bus > taxi. Il mezzo a lunga
      // percorrenza vince su quello locale per rappresentare la tratta tra città.
      const dayMode: string | null =
        dayModes.has("flight") ? "flight" :
        dayModes.has("train")  ? "train"  :
        dayModes.has("ferry")  ? "ferry"  :
        dayModes.has("car")    ? "car"    :
        dayModes.has("bus")    ? "bus"    :
        dayModes.has("taxi")   ? "taxi"   : null;
      if (dayPoints.length > 1) byDay[dayIndex] = dayPoints;
      if (dayPoints.length > 0) {
        dayInfo[dayIndex] = {
          first: dayPoints[0]!,
          last: dayPoints[dayPoints.length - 1]!,
          city: (day.city || "").toLowerCase().trim(),
          mode: dayMode,
        };
      }
    });

    // Classifica un mezzo in stile linea: strada (piena) vs tratteggiata.
    // Senza mezzo esplicito: < 200km in auto (piena), oltre → tratteggiata (volo).
    const classify = (mode: string | null, from: google.maps.LatLngLiteral, to: google.maps.LatLngLiteral): "road" | "dashed" => {
      // Rispetta SEMPRE il mezzo dichiarato: volo/treno → tratteggiata; auto/bus/taxi/
      // traghetto → percorso reale su strada (Google, traghetto incluso). Solo se il
      // mezzo non è noto si stima dalla distanza (>200km → probabile volo).
      if (mode && ROAD_MODES.includes(mode)) return "road";
      if (mode && DASHED_MODES.includes(mode)) return "dashed";
      return haversineKm(from, to) <= 200 ? "road" : "dashed";
    };

    const conns: Connector[] = [];

    // Tragitto di andata: città di partenza → prima tappa del giorno 1.
    const firstDay = dayInfo.find(Boolean);
    if (itinerary.departureCoords?.lat && itinerary.departureCoords?.lng && firstDay) {
      const from = { lat: itinerary.departureCoords.lat, lng: itinerary.departureCoords.lng };
      conns.push({ from, to: firstDay.first, mode: classify(firstDay.mode, from, firstDay.first) });
    }

    // Collegamenti tra giorni consecutivi quando cambia città (o c'è un salto > 25km).
    for (let i = 0; i < dayInfo.length - 1; i++) {
      const a = dayInfo[i]; const b = dayInfo[i + 1];
      if (!a || !b) continue;
      const cityChanged = a.city && b.city ? a.city !== b.city : haversineKm(a.last, b.first) > 25;
      if (!cityChanged) continue;
      conns.push({ from: a.last, to: b.first, mode: classify(b.mode, a.last, b.first) });
    }

    return { markers: out, polylinesByDay: byDay, connectors: conns };
  }, [itinerary]);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
    if (!apiKey || !mapRef.current) return;

    const mobile = isTouchDevice();

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
        zoomControl: !mobile,          // ← nasconde + e - solo su touch
        zoomControlOptions: mobile ? undefined : {
          // RIGHT_TOP: sempre visibile anche su colonna mappa stretta (15"),
          // non collide con la legenda giorni in basso a sinistra.
          position: google.maps.ControlPosition.RIGHT_TOP,
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
            text: String(m.seq),
            color: "#ffffff",
            fontSize: "11px",
            fontWeight: "bold",
          },
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="font-family:Inter,sans-serif;padding:4px 2px;min-width:150px">
              <div style="font-size:10px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">
                Giorno ${m.day} · Tappa ${m.seq} · ${m.time}
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

      // Collegamenti tra città / tragitto di andata.
      // Auto/bus/taxi → percorso reale su strada (linea piena).
      // Volo/treno/traghetto o lunga distanza → linea tratteggiata diretta.
      const dashSymbol = {
        path: "M 0,-1 0,1",
        strokeOpacity: 1,
        strokeWeight: 3,
        scale: 3,
      };
      connectors.forEach((c) => {
        bounds.extend(c.from);
        bounds.extend(c.to);

        if (c.mode === "road") {
          const ds = new google.maps.DirectionsService();
          const dr = new google.maps.DirectionsRenderer({
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: { strokeColor: CONNECTOR_COLOR, strokeOpacity: 0.85, strokeWeight: 4 },
          });
          dr.setMap(googleMapRef.current!);
          ds.route(
            { origin: c.from, destination: c.to, travelMode: google.maps.TravelMode.DRIVING },
            (result, status) => {
              if (status === "OK" && result) {
                dr.setDirections(result);
              } else {
                // Fallback: linea retta tratteggiata se Directions fallisce.
                const pl = new google.maps.Polyline({
                  path: [c.from, c.to], geodesic: true, strokeOpacity: 0,
                  icons: [{ icon: dashSymbol, offset: "0", repeat: "14px" }],
                  map: googleMapRef.current!,
                });
                polylinesRef.current.push(pl);
              }
            }
          );
        } else {
          const pl = new google.maps.Polyline({
            path: [c.from, c.to],
            geodesic: true,
            strokeColor: CONNECTOR_COLOR,
            strokeOpacity: 0,
            icons: [{ icon: { ...dashSymbol, strokeColor: CONNECTOR_COLOR }, offset: "0", repeat: "14px" }],
            map: googleMapRef.current!,
          });
          polylinesRef.current.push(pl);
        }
      });

      // Fit bounds
      if (markers.length > 1 || connectors.length > 0) {
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
  }, [markers, polylinesByDay, connectors]);

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