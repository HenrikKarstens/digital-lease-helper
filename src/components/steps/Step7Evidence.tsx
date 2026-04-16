import React, { memo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Camera, X, CheckCircle2, Crosshair, Clock, Compass,
  AlertTriangle, Euro, ChevronDown, Pencil, Trash2, Plus,
  FileText, StickyNote, ArrowRight, Loader2, Gauge, Zap, Droplets, Flame, Thermometer, HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/authFetch';
import { useHandover, Finding, EntryType } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useGeoPhoto } from '@/hooks/useGeoPhoto';
import { GeoPermissionGuard } from '@/components/GeoPermissionGuard';
import { processForensicPhoto } from '@/lib/photoForensics';

// ─── Data ────────────────────────────────────────────────────────────────────

const ROOMS_INDOOR = [
  'Flur', 'Wohnzimmer', 'Schlafzimmer', 'Kinderzimmer', 'Bad', 'Gäste-WC', 'Küche', 'Abstellraum',
];
const ROOMS_OUTDOOR = [
  'Balkon/Terrasse', 'Garten', 'Garage', 'Carport', 'Keller', 'Dachboden', 'Außenbereich',
];

const METER_MEDIUM_ICONS: Record<string, React.ElementType> = {
  Strom: Zap, Zweirichtungszähler: Zap, 'Strom (Bezug 1.8.0)': Zap, 'Strom (Einspeisung 2.8.0)': Zap,
  Wasser: Droplets, 'Wasser (kalt)': Droplets, 'Wasser (warm)': Droplets,
  Gas: Flame, Wärmemengenzähler: Thermometer, Heizkostenverteiler: Thermometer, Sonstiges: HelpCircle,
};

type Phase = 'list' | 'camera' | 'room-select' | 'analyzing' | 'result' | 'manual-entry' | 'edit';

// ─── RoomDropdown helper ──────────────────────────────────────────────────────

interface RoomDropdownProps {
  value: string;
  onChange: (v: string) => void;
  floorPlanRooms: { id: string; name: string }[];
}
const RoomDropdown = ({ value, onChange, floorPlanRooms }: RoomDropdownProps) => (
  <div className="relative">
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full h-11 rounded-xl border border-border bg-background px-3 pr-8 text-sm font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="" disabled>Raum auswählen …</option>
      {floorPlanRooms.length > 0 && (
        <optgroup label="Aus Grundriss">
          {floorPlanRooms.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
        </optgroup>
      )}
      <optgroup label="Innen">
        {ROOMS_INDOOR.filter(sr => !floorPlanRooms.some(r => r.name === sr)).map(sr => (
          <option key={sr} value={sr}>{sr}</option>
        ))}
      </optgroup>
      <optgroup label="Außen / Neben">
        {ROOMS_OUTDOOR.map(sr => <option key={sr} value={sr}>{sr}</option>)}
      </optgroup>
    </select>
    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const Step7Evidence = () => {
  const { evidenceTitle, evidenceSubtitle, isMoveIn } = useTransactionLabels();
  const { data, updateData, goToStepById } = useHandover();
  const { toast } = useToast();
  const { requestPermission, captureGeo, geoDenied } = useGeoPhoto(data.propertyAddress);
  const [showGeoGuard, setShowGeoGuard] = useState(false);
  const [pendingCameraAction, setPendingCameraAction] = useState(false);

  const [phase, setPhase] = useState<Phase>('list');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [locationDetail, setLocationDetail] = useState('');
  const [currentResult, setCurrentResult] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState('KI analysiert Foto...');

  // Captured photo file for AI analysis
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  // Manual / note entry state
  const [manualDesc, setManualDesc] = useState('');
  const [manualRoom, setManualRoom] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [manualType, setManualType] = useState<EntryType>('defect');

  // Editable fields for result phase & edit phase
  const [editMaterial, setEditMaterial] = useState('');
  const [editDamageType, setEditDamageType] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Real camera input ref
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setCapturedFile(file);
    // Create preview URL
    const reader = new FileReader();
    reader.onload = (ev) => setCapturedPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setPhase('room-select');
  };

  // Open camera with geo permission guard
  const openCameraWithGeoGuard = useCallback(() => {
    if (data.geoPermissionGranted || data.geoPermissionDenied) {
      cameraInputRef.current?.click();
      return;
    }
    setShowGeoGuard(true);
  }, [data.geoPermissionGranted, data.geoPermissionDenied]);

  const handleGeoGranted = useCallback(async () => {
    setShowGeoGuard(false);
    updateData({ geoPermissionGranted: true });
    await requestPermission();
    if (geoDenied) {
      updateData({ geoPermissionDenied: true });
    }
    cameraInputRef.current?.click();
  }, [requestPermission, geoDenied, updateData]);

  const handleGeoDeniedProceed = useCallback(() => {
    setShowGeoGuard(false);
    updateData({ geoPermissionDenied: true });
    toast({
      title: '⚠ Ohne GPS-Standort',
      description: 'Ohne Standortdaten sinkt die Beweiskraft dieses Protokolls vor Gericht erheblich.',
      variant: 'destructive',
    });
    cameraInputRef.current?.click();
  }, [updateData, toast]);

  // ── Real AI analysis ───────────────────────────────────────────────────────
  const runAiAnalysis = useCallback(async () => {
    if (!capturedFile) return;

    setPhase('analyzing');
    setAnalysisMessage('KI analysiert Foto...');

    try {
      const formData = new FormData();
      formData.append('file', capturedFile);
      formData.append('context', 'evidence');
      formData.append('room', selectedRoom);
      formData.append('isMoveIn', String(isMoveIn));

      setAnalysisMessage('Erkenne Material & Schaden...');

      const response = await authFetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-photo`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Keine Analysedaten erhalten');
      }

      const aiData = result.data;

      // If AI suggested a room and user hasn't selected one, use it
      if (!selectedRoom && aiData.suggestedRoom) {
        setSelectedRoom(aiData.suggestedRoom);
      }

      setCurrentResult(aiData);
      setEditMaterial(aiData.material || 'Nicht bestimmbar');
      setEditDamageType(aiData.damageType || '');
      setEditDescription(aiData.description || '');
      setPhase('result');
    } catch (err: any) {
      console.error('AI analysis failed:', err);
      toast({
        title: 'KI-Analyse fehlgeschlagen',
        description: err.message || 'Bitte versuchen Sie es erneut oder nutzen Sie die manuelle Eingabe.',
        variant: 'destructive',
      });
      // Fall back to result phase with empty data so user can fill manually
      setCurrentResult({
        material: '',
        damageType: '',
        description: '',
        bghReference: '',
        timeValueDeduction: 0,
        recommendedWithholding: 0,
      });
      setEditMaterial('');
      setEditDamageType('');
      setEditDescription('');
      setPhase('result');
    }
  }, [capturedFile, selectedRoom, isMoveIn, toast]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const resetFlow = () => {
    setPhase('list');
    setSelectedRoom('');
    setLocationDetail('');
    setCurrentResult(null);
    setEditingId(null);
    setCapturedFile(null);
    setCapturedPreview(null);
  };

  const deleteFinding = (id: string) => {
    updateData({ findings: data.findings.filter(f => f.id !== id) });
  };

  const startEdit = (f: Finding) => {
    setEditingId(f.id);
    setManualRoom(f.room);
    setManualLocation(f.locationDetail || '');
    setManualType(f.entryType || 'defect');
    setEditMaterial(f.material);
    setEditDamageType(f.damageType);
    setEditDescription(f.description);
    setPhase('edit');
  };

  const saveEdit = () => {
    updateData({
      findings: data.findings.map(f =>
        f.id === editingId
          ? {
              ...f,
              room: manualRoom,
              material: editMaterial,
              damageType: editDamageType,
              description: editDescription,
              locationDetail: manualLocation,
              entryType: manualType,
            }
          : f
      ),
    });
    resetFlow();
  };

  const saveManual = () => {
    if (!manualDesc.trim() || !manualRoom) return;
    const finding: Finding = {
      id: Date.now().toString(),
      room: manualRoom,
      pinX: 50,
      pinY: 50,
      material: '–',
      damageType: manualDesc.trim(),
      bghReference: '',
      timeValueDeduction: 0,
      recommendedWithholding: 0,
      description: manualDesc.trim(),
      timestamp: new Date().toLocaleString('de-DE'),
      locationDetail: manualLocation.trim() || undefined,
      entryType: manualType,
    };
    updateData({ findings: [...data.findings, finding] });
    setManualDesc('');
    setManualRoom('');
    setManualLocation('');
    setManualType('defect');
    setPhase('list');
  };

  const saveFinding = async () => {
    if (!selectedRoom) return;
    const geo = await captureGeo();

    // Forensic watermark + SHA-256 hash
    let finalPhotoUrl = capturedPreview || undefined;
    let sha256Hash: string | undefined;
    if (capturedPreview) {
      try {
        const protocolId = Date.now().toString(36).toUpperCase();
        const { processedUrl, forensic } = await processForensicPhoto(
          capturedPreview, protocolId, geo.latitude, geo.longitude,
        );
        finalPhotoUrl = processedUrl;
        sha256Hash = forensic.sha256;
      } catch (err) {
        console.warn('Forensic processing failed, using original:', err);
      }
    }

    const finding: Finding = {
      id: Date.now().toString(),
      room: selectedRoom,
      pinX: 50,
      pinY: 50,
      photoUrl: finalPhotoUrl,
      photoGeo: geo,
      sha256Hash,
      material: editMaterial,
      damageType: editDamageType,
      bghReference: currentResult?.bghReference || '',
      timeValueDeduction: currentResult?.timeValueDeduction || 0,
      recommendedWithholding: currentResult?.recommendedWithholding || 0,
      description: editDescription,
      timestamp: new Date().toLocaleString('de-DE'),
      locationDetail: locationDetail.trim() || undefined,
      entryType: (currentResult?.recommendedWithholding || 0) > 0 ? 'defect' : 'note',
    };
    updateData({ findings: [...data.findings, finding] });
    resetFlow();
  };

  const defects = data.findings.filter(f => f.entryType !== 'note');
  const notes = data.findings.filter(f => f.entryType === 'note');
  const totalWithholding = defects.reduce((s, f) => s + f.recommendedWithholding, 0);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE: LIST (main view)
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'list') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
        <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold mb-1 text-center">{isMoveIn ? 'Zustandsdokumentation (Einzug)' : evidenceTitle}</motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}
          className="text-muted-foreground text-center mb-6 text-sm">{isMoveIn ? 'Dokumentieren Sie den Ist-Zustand der Immobilie bei Einzug.' : evidenceSubtitle}</motion.p>

        <div className="w-full max-w-md space-y-4">

          {/* ── Action buttons ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => setPhase('camera')}
              className="h-auto min-h-[5rem] rounded-2xl gap-2 text-sm font-semibold flex-col items-center justify-center px-3 py-4"
              variant="outline"
            >
              <Camera className="w-6 h-6 shrink-0" />
              <div className="text-center">
                <div className="text-xs leading-tight">Fotoerfassung</div>
                <div className="text-[10px] font-normal text-muted-foreground mt-0.5">{isMoveIn ? 'Zustand per Bild' : 'KI-Analyse'}</div>
              </div>
            </Button>
            <Button
              onClick={() => { setManualType('defect'); setPhase('manual-entry'); }}
              className="h-auto min-h-[5rem] rounded-2xl gap-2 text-sm font-semibold flex-col items-center justify-center px-3 py-4"
              variant="outline"
            >
              <FileText className="w-6 h-6 text-amber-500 shrink-0" />
              <div className="text-center">
                <div className="text-xs leading-tight">Manueller Eintrag</div>
                <div className="text-[10px] font-normal text-muted-foreground mt-0.5">Ohne Foto</div>
              </div>
            </Button>
          </motion.div>

          {/* ── Defects list ── */}
          {defects.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Mängel ({defects.length})
              </h3>
              <div className="space-y-2">
                {defects.map((f, i) => (
                  <FindingCard key={f.id} f={f} onEdit={() => startEdit(f)} onDelete={() => deleteFinding(f.id)} />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Notes list ── */}
          {notes.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <StickyNote className="w-3.5 h-3.5 text-primary" /> Besonderheiten ({notes.length})
              </h3>
              <div className="space-y-2">
                {notes.map(f => (
                  <FindingCard key={f.id} f={f} onEdit={() => startEdit(f)} onDelete={() => deleteFinding(f.id)} />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Meter photos from Phase 8 ── */}
          {data.meterReadings.filter(m => m.photoUrl).length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-primary" /> Zählerfotos ({data.meterReadings.filter(m => m.photoUrl).length})
              </h3>
              <div className="space-y-2">
                {data.meterReadings.filter(m => m.photoUrl).map(meter => {
                  const Icon = METER_MEDIUM_ICONS[meter.medium] || Gauge;
                  return (
                    <MeterPhotoCard key={meter.id} meter={meter} Icon={Icon} />
                  );
                })}
              </div>
            </motion.div>
          )}


          {defects.length > 0 && !isMoveIn && (
            <motion.div
              key={totalWithholding}
              initial={{ scale: 1.02 }}
              animate={{ scale: 1 }}
              className="glass-card rounded-2xl p-4 flex items-center justify-between"
            >
              <span className="text-sm font-semibold">Geschätzter Kautionseinbehalt</span>
              <span className="text-xl font-bold text-destructive">{totalWithholding} €</span>
            </motion.div>
          )}

          {/* ── Continue ── */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            {data.findings.length === 0 ? (
              <Button variant="outline" onClick={() => goToStepById('keys')} className="w-full h-12 rounded-2xl font-semibold">
                Weiter ohne Befunde →
              </Button>
            ) : (
              <Button onClick={() => goToStepById('keys')} className="w-full h-12 rounded-2xl font-semibold gap-2" size="lg">
                Weiter zur Schlüssel-Inventur
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE: CAMERA (Foto-First) – now with GPS Permission Guard
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'camera') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8 gap-4">
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleCameraCapture}
        />
        <GeoPermissionGuard
          open={showGeoGuard}
          propertyAddress={data.propertyAddress}
          onGranted={handleGeoGranted}
          onDenied={handleGeoDeniedProceed}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card rounded-3xl p-8 w-full max-w-md text-center space-y-4"
        >
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Camera className="w-7 h-7 text-primary" />
          </div>
          <h3 className="font-bold text-lg">Foto aufnehmen</h3>
          <p className="text-sm text-muted-foreground">
            Kamera öffnet sich – Schaden oder Zustand fotografieren, danach Raum zuordnen.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={resetFlow} className="flex-1 rounded-2xl">
              Abbrechen
            </Button>
            <Button onClick={openCameraWithGeoGuard} className="flex-1 rounded-2xl gap-2">
              <Camera className="w-4 h-4" />
              Kamera öffnen
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE: ROOM-SELECT (after photo)
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'room-select') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl p-6 w-full max-w-md space-y-5"
        >
          {/* Photo preview */}
          {capturedPreview && (
            <div className="w-full h-40 rounded-xl overflow-hidden bg-secondary/30">
              <img src={capturedPreview} alt="Aufgenommenes Foto" className="w-full h-full object-cover" />
            </div>
          )}

          <div>
            <h3 className="font-bold text-lg mb-1">In welchem Raum?</h3>
            <p className="text-sm text-muted-foreground">Ordne das Foto dem richtigen Bereich zu.</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Raum *</label>
              <RoomDropdown value={selectedRoom} onChange={setSelectedRoom} floorPlanRooms={data.rooms} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Genaue Lage (optional)
              </label>
              <input
                type="text"
                value={locationDetail}
                onChange={e => setLocationDetail(e.target.value)}
                placeholder="z. B. Decke hinten rechts, Wand neben Fenster"
                className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setPhase('camera')} className="flex-1 rounded-xl">
              ← Zurück
            </Button>
            <Button
              disabled={!selectedRoom}
              onClick={runAiAnalysis}
              className="flex-1 rounded-xl gap-1"
            >
              KI analysieren
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE: ANALYZING (real AI call in progress)
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'analyzing') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card rounded-3xl p-8 w-full max-w-md text-center"
        >
          {/* Photo thumbnail */}
          {capturedPreview && (
            <div className="w-24 h-24 rounded-xl overflow-hidden mx-auto mb-4 border-2 border-primary/20">
              <img src={capturedPreview} alt="Wird analysiert" className="w-full h-full object-cover" />
            </div>
          )}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary mx-auto mb-6"
          />
          <h3 className="font-semibold text-lg mb-2">KI analysiert...</h3>
          <p className="text-sm text-muted-foreground">{analysisMessage}</p>
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE: RESULT
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'result') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-card rounded-3xl p-6 w-full max-w-md"
        >
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <h3 className="font-semibold text-lg">KI-Analyse</h3>
            <span className="ml-auto text-xs text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full">{selectedRoom}</span>
          </div>

          {/* Photo preview in result */}
          {capturedPreview && (
            <div className="w-full h-36 rounded-xl overflow-hidden mb-4 bg-secondary/30">
              <img src={capturedPreview} alt="Analysiertes Foto" className="w-full h-full object-cover" />
            </div>
          )}

          {currentResult?.confidence && (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Konfidenz:</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                currentResult.confidence === 'high' ? 'bg-success/20 text-success' :
                currentResult.confidence === 'medium' ? 'bg-amber-500/20 text-amber-600' :
                'bg-destructive/20 text-destructive'
              }`}>
                {currentResult.confidence === 'high' ? 'Hoch' : currentResult.confidence === 'medium' ? 'Mittel' : 'Niedrig'}
              </span>
            </div>
          )}

          <div className="space-y-4">
            {/* Editable Material */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Erkanntes Material</label>
              <input
                type="text"
                value={editMaterial}
                onChange={e => setEditMaterial(e.target.value)}
                placeholder="z. B. Eichenparkett, Laminat"
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {/* Editable Schadensart */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Schadensart</label>
              <textarea
                value={editDamageType}
                onChange={e => setEditDamageType(e.target.value)}
                placeholder="z. B. Kratzer, ca. 15cm"
                rows={2}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            {/* Detaillierte Beschreibung */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Detaillierte Beschreibung
                <span className="text-[10px] font-normal ml-1 text-muted-foreground">(editierbar)</span>
              </label>
              <textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                placeholder="Weitere Details zur Dokumentation…"
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            {!isMoveIn && currentResult?.bghReference && (
              <div className="bg-secondary/60 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">BGH-Referenz</p>
                <p className="text-sm font-mono font-medium">{currentResult.bghReference}</p>
              </div>
            )}
            {!isMoveIn && (currentResult?.timeValueDeduction || currentResult?.recommendedWithholding) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary/60 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">Zeitwert-Abzug</p>
                  <p className="text-lg font-bold">{currentResult.timeValueDeduction || 0}%</p>
                </div>
                <div className="bg-primary/10 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">Empfohlener Einbehalt</p>
                  <div className="flex items-center gap-1">
                    <Euro className="w-4 h-4 text-primary" />
                    <p className="text-lg font-bold text-primary">{currentResult.recommendedWithholding || 0}</p>
                  </div>
                </div>
              </div>
            )}
            {locationDetail && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> {locationDetail}
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={resetFlow} className="flex-1 rounded-xl">Verwerfen</Button>
            <Button onClick={saveFinding} className="flex-1 rounded-xl gap-1">
              <CheckCircle2 className="w-4 h-4" /> Übernehmen
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE: MANUAL ENTRY / EDIT
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'manual-entry' || phase === 'edit') {
    const isEdit = phase === 'edit';
    const onSave = isEdit ? saveEdit : saveManual;
    const canSave = manualRoom && (isEdit ? (editDamageType.trim() || editDescription.trim()) : manualDesc.trim());

    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl p-6 w-full max-w-md space-y-5"
        >
          <div>
            <h3 className="font-bold text-lg mb-1">
              {isEdit ? 'Eintrag bearbeiten' : manualType === 'note' ? 'Besonderheit / Notiz' : 'Manueller Mangel'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? 'Material, Schadensart und Beschreibung anpassen.'
                : manualType === 'note'
                  ? 'Reiner Beweisanker ohne Kautionsabzug (z. B. Lampe demontiert).'
                  : 'Mangel ohne Foto dokumentieren.'}
            </p>
          </div>

          {/* Type toggle */}
          <div className="flex gap-2">
            {(['defect', 'note'] as EntryType[]).map(t => (
              <button
                key={t}
                onClick={() => setManualType(t)}
                className={`flex-1 h-10 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                  manualType === t
                    ? t === 'defect'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-400'
                      : 'bg-primary/10 border-primary text-primary'
                    : 'border-border text-muted-foreground'
                }`}
              >
                {t === 'defect' ? <><AlertTriangle className="w-3.5 h-3.5" /> Mangel</> : <><StickyNote className="w-3.5 h-3.5" /> Besonderheit</>}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Raum *</label>
              <RoomDropdown value={manualRoom} onChange={setManualRoom} floorPlanRooms={data.rooms} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Genaue Lage (optional)
              </label>
              <input
                type="text"
                value={manualLocation}
                onChange={e => setManualLocation(e.target.value)}
                placeholder="z. B. Deckenlampe demontiert, Fensterbrett links"
                className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {isEdit && (
              <>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Material</label>
                  <input
                    type="text"
                    value={editMaterial}
                    onChange={e => setEditMaterial(e.target.value)}
                    placeholder="z. B. Eichenparkett, Laminat, Fliesen"
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Schadensart</label>
                  <textarea
                    value={editDamageType}
                    onChange={e => setEditDamageType(e.target.value)}
                    placeholder="z. B. Kratzer, ca. 15cm"
                    rows={2}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Detaillierte Beschreibung / Notiz</label>
                  <textarea
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    placeholder="Weitere Details…"
                    rows={3}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>
              </>
            )}

            {!isEdit && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Beschreibung *
                </label>
                <textarea
                  value={manualDesc}
                  onChange={e => setManualDesc(e.target.value)}
                  placeholder="Was wurde festgestellt?"
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={resetFlow} className="flex-1 rounded-xl">Abbrechen</Button>
            <Button disabled={!canSave} onClick={onSave} className="flex-1 rounded-xl gap-1">
              <CheckCircle2 className="w-4 h-4" />
              {isEdit ? 'Speichern' : 'Hinzufügen'}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
};

// ─── Finding Card ─────────────────────────────────────────────────────────────

interface FindingCardProps {
  f: Finding;
  onEdit: () => void;
  onDelete: () => void;
}
const FindingCard = memo(({ f, onEdit, onDelete }: FindingCardProps) => {
  const isNote = f.entryType === 'note';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`glass-card rounded-xl p-3 border ${isNote ? 'border-primary/20' : 'border-amber-500/20'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {f.photoUrl && (
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-secondary/30">
              <img src={f.photoUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          {!f.photoUrl && (
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isNote ? 'bg-primary' : 'bg-amber-400'}`} />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">{f.room}</span>
              {f.locationDetail && (
                <span className="text-xs text-muted-foreground">· {f.locationDetail}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{f.description || f.damageType}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
});
FindingCard.displayName = 'FindingCard';

// ─── Meter Photo Card ─────────────────────────────────────────────────────────

import type { MeterReading } from '@/context/HandoverContext';

interface MeterPhotoCardProps {
  meter: MeterReading;
  Icon: React.ElementType;
}
const MeterPhotoCard = memo(({ meter, Icon }: MeterPhotoCardProps) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-3 border border-primary/20"
    >
      <div className="flex items-start gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-secondary/30 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all"
        >
          <img src={meter.photoUrl} alt={meter.medium} className="w-full h-full object-cover" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-sm font-semibold">{meter.medium}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {meter.meterNumber && `Nr. ${meter.meterNumber} · `}{meter.reading} {meter.unit}
            {meter.location && ` · ${meter.location}`}
          </p>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-2"
          >
            <img
              src={meter.photoUrl}
              alt={`${meter.medium} Zählerfoto`}
              className="w-full rounded-xl border border-border/50"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
MeterPhotoCard.displayName = 'MeterPhotoCard';
