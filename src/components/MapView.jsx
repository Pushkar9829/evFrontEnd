import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { useEffect } from 'react';

const pin = (color, label = '') => L.divIcon({
  className: '',
  iconSize: [30, 38],
  iconAnchor: [15, 38],
  popupAnchor: [0, -34],
  html: `<div style="position:relative;width:30px;height:38px"><svg viewBox="0 0 30 38" width="30" height="38"><path d="M15 37s13-11.4 13-22A13 13 0 0 0 2 15c0 10.6 13 22 13 22z" fill="${color}" stroke="#fff" stroke-width="2"/></svg><span style="position:absolute;top:6px;left:0;right:0;text-align:center;color:#fff;font:700 11px system-ui">${label}</span></div>`,
});
const COLORS = { available: '#059669', busy: '#0284c7', down: '#94a3b8', partner: '#7c3aed', fault: '#dc2626' };

function Fit({ points, center }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
    else if (points.length === 1) map.setView(points[0], 14);
    else if (center) map.setView(center, 11);
  }, [JSON.stringify(points), center?.[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** markers: [{ id, lat, lng, kind: available|busy|down|partner|fault, label, popup: ReactNode }] */
export default function MapView({ markers = [], center = [18.52, 73.86], height = 360, me }) {
  const pts = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng)).map((m) => [m.lat, m.lng]);
  return (
    <div style={{ height }} className="overflow-hidden rounded-2xl border border-ink-200 dark:border-ink-800">
      <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Fit points={pts} center={center} />
        {me && <Marker position={[me.lat, me.lng]} icon={L.divIcon({ className: '', iconSize: [16, 16], html: '<div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 4px rgba(37,99,235,.25)"></div>' })} />}
        {markers.filter((m) => Number.isFinite(m.lat)).map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={pin(COLORS[m.kind] || COLORS.down, m.label)}>
            {m.popup && <Popup>{m.popup}</Popup>}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
