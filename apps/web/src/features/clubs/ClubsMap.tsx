import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useClubsGeo } from '@/lib/queries';

/**
 * Carte DECORATIVE des clubs du groupe (fond du heros de l accueil).
 *
 * Leaflet en lecture seule (aucune interaction : c est un fond, pas une carte a
 * explorer). Tuiles sombres pour se fondre dans le vert du heros ; marqueurs en
 * couleur d accent. Ne rend rien tant qu il n y a pas de coordonnees (le
 * degrade du heros reste visible). Isolee : un fichier + un endpoint.
 */
export function ClubsMap({ className }: { className?: string }) {
  const { data } = useClubsGeo();
  const clubs = data?.clubs ?? [];
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!el.current || clubs.length === 0) return undefined;

    const map = L.map(el.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      tap: false,
    });

    // Fond sombre ESRI (gratuit, sans cle) : se marie au vert du heros.
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 16 },
    ).addTo(map);

    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-accent').trim() || '#C3DC4E';

    const points: L.LatLngExpression[] = [];
    for (const c of clubs) {
      L.circleMarker([c.lat, c.lng], {
        radius: 6,
        color: '#ffffff',
        weight: 2,
        fillColor: accent,
        fillOpacity: 1,
        interactive: false,
      }).addTo(map);
      points.push([c.lat, c.lng]);
    }

    if (points.length === 1) {
      map.setView(points[0]!, 11);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 9 });
    }

    // Le conteneur peut etre dimensionne apres le montage.
    const t = window.setTimeout(() => map.invalidateSize(), 0);

    return () => { window.clearTimeout(t); map.remove(); };
  }, [clubs]);

  if (clubs.length === 0) return null;
  return <div ref={el} className={className} aria-hidden="true" />;
}
