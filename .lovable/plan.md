

# EstateTurn – Phase 1: Kern-Flow (Schritte 1–7)

## Überblick
Eine hochwertige Progressive Web App (PWA) im Apple "Trust-Tech"-Design für den deutschen Immobilienmarkt. Phase 1 umfasst den Kern-Flow mit dem Wow-Moment der KI-Beweissicherung. KI-Features werden als realistische Simulation gebaut, mit einer Architektur, die echte KI-Integration später ermöglicht.

## Design-System
- **Farben**: Navy Blue (#0A192F) als Hauptfarbe, Vivid Green (#22C55E) für Erfolg/Checks, Soft Gray Hintergründe
- **Stil**: Clean, minimalistisch, iOS-inspiriert mit abgerundeten Karten, sanften Schatten
- **Sprache**: Komplett Deutsch
- **Navigation**: Globaler Fortschrittsbalken über 14 Schritte (Schritte 8-14 als "Coming Soon" ausgegraut)
- **Animationen**: Framer Motion für Seitenübergänge, KI-Analyse-Animationen und Micro-Interactions
- **PWA**: Installierbar vom Browser, Offline-Ready-Anzeige

## Seite 1 – Startseite (Hero)
- Logo "EstateTurn" mit animiertem Einstieg
- Drei animierte Feature-Karten: "Vertrags-KI", "Mängel-Experte", "Versorger-Wechsel"
- Call-to-Action: "Übergabe starten"
- Vertrauenselemente (z.B. "Rechtssicher nach deutschem Mietrecht")

## Seite 2 – Rollenwahl
- Zwei große, intuitive Karten zur Auswahl:
  - "Vermieter / Verkäufer" (mit passendem Icon)
  - "Mieter / Käufer" (mit passendem Icon)
- Auswahl beeinflusst den weiteren Flow und die Perspektive

## Seite 3 – Smart-Einstieg
- Button "Vertrag scannen (KI-Analyse)" – öffnet Datei-Upload mit simulierter KI-Verarbeitung
- Button "Manuelle Eingabe" – leitet zu einem Formular weiter
- Bei Upload: Animierter Fortschritt mit Meldungen wie "Analysiere Vertragsdaten...", "Extrahiere Parteien..."

## Seite 4 – Daten-Validierung
- Review-Ansicht der extrahierten/eingegebenen Daten
- Editierbare Felder: Objektadresse, Vermieter/Mieter-Daten, Kautionshöhe, Vertragsdaten
- Validierungs-Checks mit grünen Häkchen
- "Daten bestätigen"-Button

## Seite 5 – Grundriss-Setup
- Drag & Drop Upload-Zone für Grundriss-Bilder
- Nach Upload: Interaktive 2D-Ansicht des Grundrisses
- Räume können benannt und markiert werden
- Dient als Navigationsbasis für die Beweissicherung in Schritt 7

## Seite 6 – Teilnehmer
- Liste der Beteiligten (aus Schritt 4 vorausgefüllt)
- Möglichkeit, weitere Teilnehmer hinzuzufügen
- Upload-Feld für Foto des analogen Anwesenheitszettels ("Beweis-Anker")
- Jeder Teilnehmer bekommt einen Status (anwesend/abwesend)

## Seite 7 – Beweissicherung (Wow-Moment)
- **Grundriss-Interaktion**: Nutzer tippt auf den Grundriss → Pin erscheint am gewählten Ort
- **Kamera-Mock**: Simuliertes Kamera-Interface mit Metadaten-Overlay (GPS-Koordinaten, Zeitstempel, Kompass-Richtung)
- **Foto-Aufnahme**: Auslöser-Button erstellt simuliertes Foto
- **KI-Analyse-Animation**: Elegante Ladesequenz mit Schritten:
  1. "Analysiere Material..." 
  2. "Prüfe BGH-Urteile..."
  3. "Berechne Zeitwert..."
- **Smart-Analyse-Card** erscheint mit:
  - Erkanntes Material (z.B. "Eichenparkett")
  - Schadensart (z.B. "Kratzer, 15cm")
  - BGH-Referenz (z.B. "BGH VIII ZR 222/15")
  - Zeitwert-Abzug ("Neu für Alt") Berechnung
  - Empfohlener Einbehalt (z.B. "150 € empfohlen")
- Alle Befunde werden in einer Liste gesammelt

## Backend (Lovable Cloud + Supabase)
- **Authentifizierung**: Email-basierte Registrierung/Login
- **Datenbank-Schema**: Tabellen für Übergabe-Protokolle, Objekte, Teilnehmer, Mängel/Befunde, Zählerstände, Dokumente
- **Storage**: Buckets für Grundrisse, Fotos, Dokumente
- **Edge Functions**: Vorbereitet für spätere echte KI-Integration

## Phase 2 (spätere Iteration)
Schritte 8–14: Zähler-Scan, Signatur, Nebenkosten-Check, Mängel-Übersicht, Kautions-Schiedsrichter, Zertifikat, Utility-Switch

