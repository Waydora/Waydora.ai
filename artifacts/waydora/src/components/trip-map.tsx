import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
type ItineraryData = any;

type MarkerData = {
  key: string;
  lat: number;
  lng: number;
  day: number;
  index: number;
  title: string;
  category: string;
  time: string;
};

function makeIcon(label: string): L.DivIcon {
  return L.divIcon({
    className: "waydora-pin",
    html: `<div style="
      background: #FF8C42;
      color: #052232;
      width: 30px;
      height: 30px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      border: 2px solid white;
      font-weight: 800;
      font-size: 13px;
      font-family: Inter, sans-serif;
    "><span style="transform: rotate(45deg);">${label}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
}

function FitBounds({ markers }: { markers: MarkerData[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    if (markers.length === 1) {
      map.setView([markers[0]!.lat, markers[0]!.lng], 13, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: true });
  }, [map, markers]);
  return null;
}

export function TripMap({ itinerary }: { itinerary: ItineraryData }) {
  const markers = useMemo<MarkerData[]>(() => {
    const out: MarkerData[] = [];
    let dayCounter = 0;
    for (const day of itinerary.days) {
      dayCounter += 1;
      let act = 0;
      for (const a of day.activities) {
        act += 1;
        if (a.coordinates && typeof a.coordinates.lat === "number" && typeof a.coordinates.lng === "number") {
          out.push({
            key: `${day.day}-${act}`,
            lat: a.coordinates.lat,
            lng: a.coordinates.lng,
            day: day.day,
            index: act,
            title: a.title,
            category: a.category,
            time: a.time,
          });
        }
      }
    }
    return out;
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
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom={false}
      className="h-full w-full"
      style={{ background: "#052232" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <FitBounds markers={markers} />
      {markers.map((m) => (
        <Marker key={m.key} position={[m.lat, m.lng]} icon={makeIcon(String(m.day))}>
          <Popup>
            <div style={{ fontFamily: "Inter, sans-serif", minWidth: 160 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#FF8C42", textTransform: "uppercase", letterSpacing: 1 }}>
                Giorno {m.day} · {m.time}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#052232", marginTop: 4 }}>
                {m.title}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
