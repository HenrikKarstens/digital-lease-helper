import { useCallback, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface GeoPhotoMetadata {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: string; // ISO string with high precision
  verified: boolean; // geofencing result
  distanceMeters: number | null;
}

// Weddingstedter Str. 39, 25746 Heide — reference coordinates
const REFERENCE_LAT = 54.1953;
const REFERENCE_LNG = 9.0936;
const MAX_DISTANCE_METERS = 100; // tolerance for geofencing

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatGeoForPdf(meta: GeoPhotoMetadata | undefined | null): string {
  if (!meta || meta.latitude === null) return '';
  const lat = meta.latitude.toFixed(6);
  const lng = meta.longitude!.toFixed(6);
  const status = meta.verified ? '✓ Am Objekt verifiziert' : '⚠ Standort abweichend';
  return `GPS: ${lat}, ${lng} · ${status}`;
}

export function formatTimestampForPdf(isoStr: string | undefined | null): string {
  if (!isoStr) return '';
  try {
    return new Date(isoStr).toLocaleString('de-DE', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function useGeoPhoto(propertyAddress?: string) {
  const { toast } = useToast();
  const [geoRequested, setGeoRequested] = useState(false);
  const [geoDenied, setGeoDenied] = useState(false);
  const permissionGranted = useRef(false);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (permissionGranted.current) return true;
    if (!navigator.geolocation) {
      toast({
        title: 'Standort nicht verfügbar',
        description: 'Ihr Browser unterstützt keine Standortabfrage.',
        variant: 'destructive',
      });
      return false;
    }

    setGeoRequested(true);
    return true;
  }, [toast]);

  /** Actually trigger the browser geolocation prompt and capture coordinates */
  const captureGeo = useCallback((): Promise<GeoPhotoMetadata> => {
    const timestamp = new Date().toISOString();

    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ latitude: null, longitude: null, accuracy: null, timestamp, verified: false, distanceMeters: null });
        return;
      }

      const timeoutId = setTimeout(() => {
        resolve({ latitude: null, longitude: null, accuracy: null, timestamp, verified: false, distanceMeters: null });
      }, 8000);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timeoutId);
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = pos.coords.accuracy;
          const dist = haversineDistance(lat, lng, REFERENCE_LAT, REFERENCE_LNG);
          const verified = dist <= MAX_DISTANCE_METERS;

          permissionGranted.current = true;
          setGeoDenied(false);

          if (verified) {
            toast({
              title: '✓ Standort verifiziert',
              description: `Aufnahme erfolgte am Objekt (${Math.round(dist)}m Entfernung).`,
            });
          } else {
            toast({
              title: '⚠ Standort-Abweichung',
              description: `Aufnahme ${Math.round(dist)}m vom Objekt entfernt. Koordinaten werden trotzdem dokumentiert.`,
              variant: 'destructive',
            });
          }

          resolve({
            latitude: lat,
            longitude: lng,
            accuracy: acc,
            timestamp: new Date().toISOString(),
            verified,
            distanceMeters: Math.round(dist),
          });
        },
        (err) => {
          clearTimeout(timeoutId);
          console.warn('Geolocation error:', err);
          if (err.code === 1) {
            // PERMISSION_DENIED
            setGeoDenied(true);
          }
          resolve({ latitude: null, longitude: null, accuracy: null, timestamp, verified: false, distanceMeters: null });
        },
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
      );
    });
  }, [toast]);

  return { requestPermission, captureGeo, geoRequested, geoDenied };
}
