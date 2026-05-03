import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
type ItineraryData = any;

// Palette colori per giorno — vivace ma armoniosa
const DAY_COLORS = [
  "#FF8C42", // arancio (accent Waydora)
  "#3B82F6", // blu
  "#10B981", // verde
  "#F59E0B", // ambra
  "#8B5CF6", // viola
  "#EF4444", // rosso
  "#06B6D4", // ciano
  "#EC4899", // rosa
  "#84CC16", // lime
  "#F97316", // arancio scuro
];

function getDayColor(dayIndex: number): string {
  return DAY_COLORS[dayIndex % DAY_COLORS.length]!;
}

type MarkerData = {
  key: string;
  lat: number;
  lng: number;
  day: number;
  dayIndex: number;
  index: number;
  title: string;
  category: string;
  time: string;
};

function makeIcon(label: string, color: string): L.DivIcon {
  return L.divIcon({
    className: "waydora-pin",
    html: `<div style="
      background: ${color};
      color: #fff;
      width: 32px;
      height: 32px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 10px rgba(0,0,0,0.25);
      border: 2.5px solid white;
      font-weight: 800;
      font-size: 12px;
      font-family: Inter, sans-serif;
    "><span style="transform: rotate(45deg); line-height:1;">${label}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
  });
}

function FitBounds({ markers }: { markers: MarkerData[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    if (markers.length === 1) {
      map.setView([markers[0]!.lat, markers[0]!.lng], 14, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: true });
  }, [map, markers]);
  return null;
}

export function TripMap({ itinerary }: { itinerary: ItineraryData }) {
  const { markers, polylinesByDay } = useMemo(() => {
    const out: MarkerData[] = [];
    const byDay: Record<number, [number, number][]> = {};

    itinerary.days.forEach((day: any, dayIndex: number) => {
      let actIdx = 0;
      const dayPoints: [number, number][] = [];
      for (const a of day.activities) {
        actIdx += 1;
        if (a.coordinates && typeof a.coordinates.lat === "number" && typeof a.coordinates.lng === "number") {
          out.push({
            key: `${day.day}-${actIdx}`,
            lat: a.coordinates.lat,
            lng: a.coordinates.lng,
            day: day.day,
            dayIndex,
            index: actIdx,
            title: a.title,
            category: a.category,
            time: a.time,
          });
          dayPoints.push([a.coordinates.lat, a.coordinates.lng]);
        }
      }
      if (dayPoints.length > 1) byDay[dayIndex] = dayPoints;
    });

    return { markers: out, polylinesByDay: byDay };
  }, [itinerary]);

  if (markers.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground bg-card/40">
        <div className="text-4xl mb-3 opacity-50">🗺️</div>
        <p className="text-sm font-medium max-w-xs">
          La mappa apparirà qui quando l'itinerario avrà coordinate.
        </p>
      </div>
    );
  }

  const center: [number, number] = [markers[0]!.lat, markers[0]!.lng];

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        {/* Tile CARTO Voyager — light mode, leggibile */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <FitBounds markers={markers} />

        {/* Linee per giorno */}
        {Object.entries(polylinesByDay).map(([dayIdx, points]) => (
          <Polyline
            key={`line-${dayIdx}`}
            positions={points}
            pathOptions={{
              color: getDayColor(Number(dayIdx)),
              weight: 3,
              opacity: 0.6,
              dashArray: "6 4",
            }}
          />
        ))}

        {/* Marker per attività */}
        {markers.map((m) => (
          <Marker
            key={m.key}
            position={[m.lat, m.lng]}
            icon={makeIcon(String(m.day), getDayColor(m.dayIndex))}
          >
            <Popup>
              <div style={{ fontFamily: "Inter, sans-serif", minWidth: 160, padding: "2px 0" }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: getDayColor(m.dayIndex),
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 4,
                }}>
                  Giorno {m.day} · {m.time}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>
                  {m.title}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
                  {m.category}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legenda giorni */}
      {itinerary.days.length > 1 && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 dark:bg-card/90 backdrop-blur-sm border border-border/40 rounded-xl p-2.5 shadow-lg max-w-[160px]">
          <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Legenda</div>
          <div className="space-y-1">
            {itinerary.days.slice(0, 7).map((day: any, i: number) => (
              <div key={day.day} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: getDayColor(i) }}
                />
                <span className="text-[11px] font-medium text-foreground truncate">
                  Giorno {day.day}
                </span>
              </div>
            ))}
            {itinerary.days.length > 7 && (
              <div className="text-[10px] text-muted-foreground pt-0.5">
                +{itinerary.days.length - 7} altri...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}