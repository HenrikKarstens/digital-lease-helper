import React, { useState, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, CheckCircle2, X, AlertTriangle, StickyNote,
  ShieldCheck, Trash, Paintbrush, MapPin, Pencil, Trash2,
  Euro, ArrowLeft, Loader2, Plus, FileText, ImagePlus,
  Wrench, Droplets, Plug, CookingPot, Bath
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useHandover, Finding, EntryType } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useGeoPhoto } from '@/hooks/useGeoPhoto';
import { GeoPermissionGuard } from '@/components/GeoPermissionGuard';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { RoomConfig, TechCheckValue, TechCheckStatus } from './types';
import { Input } from '@/components/ui/input';

const MAX_OVERVIEW_PHOTOS = 5;

// Wall defect classification types
type WallDamageClass = 'verschmutzung' | 'abnutzung';

// ─── 3-Status Selector (OK / N.V. / N.G.) ───
const STATUS_OPTIONS: { value: TechCheckStatus; label: string; color: string; activeColor: string }[] = [
  { value: 'ok', label: 'OK', color: 'border-border text-muted-foreground', activeColor: 'border-accent bg-accent/15 text-accent font-bold' },
  { value: 'nv', label: 'N.V.', color: 'border-border text-muted-foreground', activeColor: 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold' },
  { value: 'ng', label: 'N.G.', color: 'border-border text-muted-foreground', activeColor: 'border-destructive bg-destructive/15 text-destructive font-bold' },
];

interface TechCheckRowProps {
  label: string;
  icon?: React.ReactNode;
  value?: TechCheckValue;
  onChange: (val: TechCheckValue) => void;
}

const TechCheckRow = ({ label, icon, value, onChange }: TechCheckRowProps) => {
  const current = value?.status ?? null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2">
        {icon}
        <span className="text-sm flex-1 leading-tight">{label}</span>
      </div>
      <div className="flex gap-1.5 ml-0">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange({ status: opt.value, comment: opt.value === 'ng' ? (value?.comment || '') : undefined })}
            className={`flex-1 h-8 rounded-xl text-xs border-2 transition-all ${
              current === opt.value ? opt.activeColor : opt.color
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {/* N.G. requires mandatory comment */}
      <AnimatePresence>
        {current === 'ng' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Input
              placeholder="Grund angeben (Pflicht) z.B. Wasser abgestellt"
              value={value?.comment || ''}
              onChange={e => onChange({ status: 'ng', comment: e.target.value })}
              className="h-8 text-xs rounded-lg border-destructive/40 focus-visible:ring-destructive/30"
            />
            {(!value?.comment || !value.comment.trim()) && (
              <p className="text-[10px] text-destructive mt-0.5">Pflichtfeld: Bitte Grund für „Nicht geprüft" angeben.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface Props {
  room: RoomConfig;
  onClose: () => void;
  onUpdate: (patch: Partial<RoomConfig>) => void;
  onComplete: () => void;
}

type Phase = 'overview' | 'camera-overview' | 'camera-defect' | 'room-select' | 'analyzing' | 'result' | 'manual-entry' | 'edit' | 'wall-classify';

export const RoomDetailSheet = memo(({ room, onClose, onUpdate, onComplete }: Props) => {
  const { data, updateData } = useHandover();
  const { isMoveIn } = useTransactionLabels();
  const { toast } = useToast();
  const { requestPermission, captureGeo, geoDenied } = useGeoPhoto(data.propertyAddress);
  
  const [phase, setPhase] = useState<Phase>('overview');
  const [showGeoGuard, setShowGeoGuard] = useState(false);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [currentResult, setCurrentResult] = useState<any>(null);
  const [editMaterial, setEditMaterial] = useState('');
  const [editDamageType, setEditDamageType] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [locationDetail, setLocationDetail] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [manualDesc, setManualDesc] = useState('');
  const [manualType, setManualType] = useState<EntryType>('defect');
  const [cameraMode, setCameraMode] = useState<'overview' | 'defect'>('defect');
  
  // Wall classification state
  const [wallDamageClass, setWallDamageClass] = useState<WallDamageClass | null>(null);
  const [wallCleanable, setWallCleanable] = useState<boolean | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const overviewCameraRef = useRef<HTMLInputElement>(null);

  const roomFindings = data.findings.filter(f => f.room === room.name);
  const defects = roomFindings.filter(f => f.entryType !== 'note');
  const notes = roomFindings.filter(f => f.entryType === 'note');
  const totalWithholding = defects.reduce((s, f) => s + f.recommendedWithholding, 0);

  // Multi-photo support
  const overviewPhotos = room.overviewPhotos || (room.overviewPhotoUrl ? [{ url: room.overviewPhotoUrl, timestamp: room.overviewPhotoTimestamp || '' }] : []);
  const canAddMorePhotos = overviewPhotos.length < MAX_OVERVIEW_PHOTOS;

  // Room-type detection
  const isKitchen = room.name.toLowerCase().includes('küche');
  const isBathroom = room.name.toLowerCase().includes('bad') || room.name.toLowerCase().includes('wc') || room.name.toLowerCase().includes('dusch');

  // Helper: check if a TechCheckValue is "decided" (not null) and valid (ng requires comment)
  const isCheckComplete = (val?: TechCheckValue): boolean => {
    if (!val || val.status === null) return false;
    if (val.status === 'ng' && (!val.comment || !val.comment.trim())) return false;
    return true;
  };

  // Validation: photos + all technical checks must be decided (move-out only)
  const hasPhotos = overviewPhotos.length > 0;
  const technicalChecksComplete = isMoveIn ? true : (
    isCheckComplete(room.windowsDoors) &&
    isCheckComplete(room.sanitary) &&
    isCheckComplete(room.electrical) &&
    isCheckComplete(room.smokeDetector) &&
    (!isKitchen || (isCheckComplete(room.oven) && isCheckComplete(room.sinkDrain))) &&
    (!isBathroom || (isCheckComplete(room.tilesGrout) && isCheckComplete(room.flushFittings)))
  );
  const canComplete = hasPhotos && technicalChecksComplete;

  // ─── Camera handlers ───
  const openCameraWithGeo = useCallback((mode: 'overview' | 'defect') => {
    setCameraMode(mode);
    // Skip guard if already granted globally
    if (data.geoPermissionGranted || data.geoPermissionDenied) {
      if (mode === 'overview') {
        overviewCameraRef.current?.click();
      } else {
        cameraRef.current?.click();
      }
      return;
    }
    setShowGeoGuard(true);
  }, [data.geoPermissionGranted, data.geoPermissionDenied]);

  const handleGeoGranted = useCallback(async () => {
    setShowGeoGuard(false);
    updateData({ geoPermissionGranted: true });
    await requestPermission();
    if (geoDenied) updateData({ geoPermissionDenied: true });
    if (cameraMode === 'overview') {
      overviewCameraRef.current?.click();
    } else {
      cameraRef.current?.click();
    }
  }, [requestPermission, geoDenied, updateData, cameraMode]);

  const handleGeoDenied = useCallback(() => {
    setShowGeoGuard(false);
    updateData({ geoPermissionDenied: true });
    toast({ title: '⚠ Ohne GPS', description: 'Beweiskraft eingeschränkt.', variant: 'destructive' });
    if (cameraMode === 'overview') {
      overviewCameraRef.current?.click();
    } else {
      cameraRef.current?.click();
    }
  }, [updateData, toast, cameraMode]);

  const handleOverviewCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      const newPhoto = { url, timestamp: new Date().toISOString() };
      const updated = [...overviewPhotos, newPhoto];
      onUpdate({
        overviewPhotos: updated,
        overviewPhotoUrl: updated[0]?.url,
        overviewPhotoTimestamp: updated[0]?.timestamp,
      });
    };
    reader.readAsDataURL(file);
  }, [onUpdate, overviewPhotos]);

  const removeOverviewPhoto = useCallback((index: number) => {
    const updated = overviewPhotos.filter((_, i) => i !== index);
    onUpdate({
      overviewPhotos: updated,
      overviewPhotoUrl: updated[0]?.url || undefined,
      overviewPhotoTimestamp: updated[0]?.timestamp || undefined,
    });
  }, [onUpdate, overviewPhotos]);

  const handleDefectCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setCapturedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setCapturedPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setPhase('analyzing');
    runAiAnalysis(file);
  }, []);

  const runAiAnalysis = useCallback(async (file: File) => {
    setAnalysisMessage('KI analysiert Foto...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('context', 'evidence');
      formData.append('room', room.name);
      formData.append('isMoveIn', String(isMoveIn));
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-photo`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: formData,
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Analyse fehlgeschlagen');
      
      setCurrentResult(result.data);
      setEditMaterial(result.data.material || '');
      setEditDamageType(result.data.damageType || '');
      setEditDescription(result.data.description || '');
      setPhase('result');
    } catch (err: any) {
      toast({ title: 'KI-Analyse fehlgeschlagen', description: err.message, variant: 'destructive' });
      setCurrentResult({ material: '', damageType: '', description: '', bghReference: '', timeValueDeduction: 0, recommendedWithholding: 0 });
      setEditMaterial(''); setEditDamageType(''); setEditDescription('');
      setPhase('result');
    }
  }, [room.name, isMoveIn, toast]);

  const saveFinding = useCallback(async () => {
    // Check if wall-related defect needs classification
    const isWallRelated = editMaterial.toLowerCase().includes('wand') || 
      editMaterial.toLowerCase().includes('tapete') ||
      editDamageType.toLowerCase().includes('wand') ||
      editDamageType.toLowerCase().includes('tapete');
    
    if (!isMoveIn && isWallRelated && wallDamageClass === null) {
      setPhase('wall-classify');
      return;
    }

    const geo = await captureGeo();
    const finding: Finding = {
      id: Date.now().toString(),
      room: room.name,
      pinX: 50, pinY: 50,
      photoUrl: capturedPreview || undefined,
      photoGeo: geo,
      material: editMaterial,
      damageType: editDamageType,
      bghReference: currentResult?.bghReference || '',
      timeValueDeduction: currentResult?.timeValueDeduction || 0,
      recommendedWithholding: wallDamageClass === 'abnutzung' ? 0 : (currentResult?.recommendedWithholding || 0),
      description: editDescription + (wallDamageClass ? ` [${wallDamageClass === 'verschmutzung' ? 'Verschmutzung' : 'Normale Abnutzung'}${wallCleanable !== null ? (wallCleanable ? ', reinigbar' : ', nicht reinigbar') : ''}]` : ''),
      timestamp: new Date().toLocaleString('de-DE'),
      locationDetail: locationDetail.trim() || undefined,
      entryType: wallDamageClass === 'abnutzung' ? 'note' : ((currentResult?.recommendedWithholding || 0) > 0 ? 'defect' : 'note'),
      legalClassification: wallDamageClass === 'abnutzung' ? 'Normalverschleiß' : wallDamageClass === 'verschmutzung' ? (wallCleanable ? 'Gebrauchsspur' : 'Schaden') : undefined,
    };
    updateData({ findings: [...data.findings, finding] });
    resetDefectFlow();
  }, [captureGeo, capturedPreview, editMaterial, editDamageType, editDescription, locationDetail, currentResult, data.findings, updateData, room.name, wallDamageClass, wallCleanable, isMoveIn]);

  const saveManual = useCallback(() => {
    if (!manualDesc.trim()) return;
    const finding: Finding = {
      id: Date.now().toString(),
      room: room.name,
      pinX: 50, pinY: 50,
      material: '–',
      damageType: manualDesc.trim(),
      bghReference: '',
      timeValueDeduction: 0,
      recommendedWithholding: 0,
      description: manualDesc.trim(),
      timestamp: new Date().toLocaleString('de-DE'),
      entryType: manualType,
    };
    updateData({ findings: [...data.findings, finding] });
    setManualDesc('');
    setPhase('overview');
  }, [manualDesc, manualType, room.name, data.findings, updateData]);

  const deleteFinding = useCallback((id: string) => {
    updateData({ findings: data.findings.filter(f => f.id !== id) });
  }, [data.findings, updateData]);

  const resetDefectFlow = () => {
    setCapturedFile(null);
    setCapturedPreview(null);
    setCurrentResult(null);
    setLocationDetail('');
    setWallDamageClass(null);
    setWallCleanable(null);
    setPhase('overview');
  };

  // ─── Hidden camera inputs ───
  const hiddenInputs = (
    <>
      <input ref={overviewCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleOverviewCapture} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleDefectCapture} />
      <GeoPermissionGuard open={showGeoGuard} propertyAddress={data.propertyAddress} onGranted={handleGeoGranted} onDenied={handleGeoDenied} />
    </>
  );

  // ═══ PHASE: WALL CLASSIFY ═══
  if (phase === 'wall-classify') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center px-4 py-6">
        {hiddenInputs}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl p-6 w-full max-w-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">Wandbefund klassifizieren</h3>
            <button onClick={resetDefectFlow} className="p-1 rounded-lg hover:bg-secondary/60"><X className="w-4 h-4" /></button>
          </div>
          
          <p className="text-sm text-muted-foreground">Handelt es sich um einen Schaden oder normale Abnutzung?</p>
          
          <div className="space-y-2">
            <button
              onClick={() => setWallDamageClass('verschmutzung')}
              className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${wallDamageClass === 'verschmutzung' ? 'border-amber-500 bg-amber-500/10' : 'border-border hover:border-amber-500/40'}`}
            >
              <p className="font-semibold text-sm">Verschmutzung (Schaden)</p>
              <p className="text-xs text-muted-foreground mt-0.5">Verursacht durch Mieter, über normale Nutzung hinaus</p>
            </button>
            <button
              onClick={() => { setWallDamageClass('abnutzung'); setWallCleanable(null); }}
              className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${wallDamageClass === 'abnutzung' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}
            >
              <p className="font-semibold text-sm">Normale Abnutzung</p>
              <p className="text-xs text-muted-foreground mt-0.5">Vertragsgemäßer Gebrauch (§ 538 BGB) – kein Einbehalt</p>
            </button>
          </div>

          {/* Cleanability follow-up for Verschmutzung */}
          <AnimatePresence>
            {wallDamageClass === 'verschmutzung' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden">
                <p className="text-sm font-medium">Ist die Verschmutzung durch Reinigung entfernbar?</p>
                <p className="text-xs text-muted-foreground">Relevant für die Kautionsabrechnung (§ 7 Mietvertrag)</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setWallCleanable(true)}
                    className={`flex-1 p-3 rounded-xl border-2 text-sm font-semibold transition-all ${wallCleanable === true ? 'border-success bg-success/10 text-success' : 'border-border'}`}
                  >
                    Ja, reinigbar
                  </button>
                  <button
                    onClick={() => setWallCleanable(false)}
                    className={`flex-1 p-3 rounded-xl border-2 text-sm font-semibold transition-all ${wallCleanable === false ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border'}`}
                  >
                    Nein, Schaden
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setPhase('result')} className="flex-1 rounded-xl">Zurück</Button>
            <Button
              disabled={wallDamageClass === null || (wallDamageClass === 'verschmutzung' && wallCleanable === null)}
              onClick={saveFinding}
              className="flex-1 rounded-xl gap-1"
            >
              <CheckCircle2 className="w-4 h-4" /> Speichern
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ═══ PHASE: ANALYZING ═══
  if (phase === 'analyzing') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        {hiddenInputs}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-3xl p-8 w-full max-w-md text-center">
          {capturedPreview && (
            <div className="w-20 h-20 rounded-xl overflow-hidden mx-auto mb-4 border-2 border-primary/20">
              <img src={capturedPreview} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-14 h-14 rounded-full border-4 border-primary/20 border-t-primary mx-auto mb-4" />
          <h3 className="font-semibold">KI analysiert...</h3>
          <p className="text-sm text-muted-foreground mt-1">{analysisMessage}</p>
        </motion.div>
      </div>
    );
  }

  // ═══ PHASE: RESULT ═══
  if (phase === 'result') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center px-4 py-6">
        {hiddenInputs}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl p-6 w-full max-w-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" />
              <h3 className="font-semibold">KI-Analyse · {room.name}</h3>
            </div>
            <button onClick={resetDefectFlow} className="p-1 rounded-lg hover:bg-secondary/60"><X className="w-4 h-4" /></button>
          </div>
          {capturedPreview && (
            <div className="w-full h-32 rounded-xl overflow-hidden bg-secondary/30">
              <img src={capturedPreview} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Material</label>
              <input type="text" value={editMaterial} onChange={e => setEditMaterial(e.target.value)}
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Schadensart</label>
              <textarea value={editDamageType} onChange={e => setEditDamageType(e.target.value)} rows={2}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Beschreibung</label>
              <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={2}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Genaue Lage (optional)</label>
              <input type="text" value={locationDetail} onChange={e => setLocationDetail(e.target.value)}
                placeholder="z. B. Wand neben Fenster"
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            {!isMoveIn && (currentResult?.recommendedWithholding > 0) && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-secondary/60 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Zeitwert-Abzug</p>
                  <p className="text-lg font-bold">{currentResult.timeValueDeduction}%</p>
                </div>
                <div className="bg-primary/10 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Einbehalt</p>
                  <p className="text-lg font-bold text-primary flex items-center gap-0.5"><Euro className="w-4 h-4" />{currentResult.recommendedWithholding}</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={resetDefectFlow} className="flex-1 rounded-xl">Verwerfen</Button>
            <Button onClick={saveFinding} className="flex-1 rounded-xl gap-1"><CheckCircle2 className="w-4 h-4" />Übernehmen</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ═══ PHASE: MANUAL ENTRY ═══
  if (phase === 'manual-entry') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center px-4 py-6">
        {hiddenInputs}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl p-6 w-full max-w-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">{manualType === 'note' ? 'Besonderheit' : 'Manueller Mangel'} · {room.name}</h3>
            <button onClick={() => setPhase('overview')} className="p-1 rounded-lg hover:bg-secondary/60"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex gap-2">
            {(['defect', 'note'] as EntryType[]).map(t => (
              <button key={t} onClick={() => setManualType(t)}
                className={`flex-1 h-9 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1 ${
                  manualType === t
                    ? t === 'defect' ? 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-400' : 'bg-primary/10 border-primary text-primary'
                    : 'border-border text-muted-foreground'
                }`}>
                {t === 'defect' ? <><AlertTriangle className="w-3 h-3" /> Mangel</> : <><StickyNote className="w-3 h-3" /> Notiz</>}
              </button>
            ))}
          </div>
          <textarea value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="Was wurde festgestellt?" rows={3}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setPhase('overview')} className="flex-1 rounded-xl">Abbrechen</Button>
            <Button disabled={!manualDesc.trim()} onClick={saveManual} className="flex-1 rounded-xl gap-1"><Plus className="w-4 h-4" />Hinzufügen</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ═══ PHASE: OVERVIEW (main room view) ═══
  return (
    <div className="min-h-[60vh] flex flex-col px-4 py-6">
      {hiddenInputs}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary/60 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{room.name}</h2>
            <p className="text-xs text-muted-foreground">{room.type === 'indoor' ? 'Innenraum' : 'Außenbereich'}</p>
          </div>
          {room.completed && <CheckCircle2 className="w-6 h-6 text-success" />}
        </div>

        {/* Multi-photo overview */}
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5" /> Übersichtsfotos ({overviewPhotos.length}/{MAX_OVERVIEW_PHOTOS})
            {overviewPhotos.length === 0 && <span className="text-destructive">*Pflicht</span>}
          </p>

          {overviewPhotos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {overviewPhotos.map((photo, i) => (
                <div key={i} className="relative group/photo">
                  <img src={photo.url} alt={`Übersicht ${i + 1}`} className="w-full h-20 rounded-xl object-cover border border-border/30" />
                  <button
                    onClick={() => removeOverviewPhoto(i)}
                    className="absolute top-1 right-1 p-0.5 rounded-md bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-destructive opacity-0 group-hover/photo:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {canAddMorePhotos && (
                <button
                  onClick={() => openCameraWithGeo('overview')}
                  className="w-full h-20 rounded-xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span className="text-[10px]">Foto</span>
                </button>
              )}
            </div>
          ) : (
            <Button variant="outline" onClick={() => openCameraWithGeo('overview')} className="w-full h-20 rounded-xl border-dashed gap-2">
              <Camera className="w-5 h-5" /> Übersichtsfoto aufnehmen
            </Button>
          )}
        </div>

        {/* Condition checks (move-out only) */}
        {!isMoveIn && (
          <div className="glass-card rounded-2xl p-4 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Zustandsprüfung
            </p>

            {/* Reinigung */}
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={room.cleaningDone || false} onCheckedChange={v => onUpdate({ cleaningDone: !!v })} />
              <span className="text-sm">Besenrein</span>
            </label>

            {/* Wandfarben */}
            <div className="flex gap-2">
              <Button size="sm" variant={room.wallsNeutral === true ? 'default' : 'outline'} className="rounded-xl text-xs h-8 flex-1"
                onClick={() => onUpdate({ wallsNeutral: true })}>
                <Paintbrush className="w-3 h-3 mr-1" /> Neutrale Farben
              </Button>
              <Button size="sm" variant={room.wallsNeutral === false ? 'destructive' : 'outline'} className="rounded-xl text-xs h-8 flex-1"
                onClick={() => onUpdate({ wallsNeutral: false })}>
                Auffällig
              </Button>
            </div>
            {room.wallsNeutral === false && (
              <p className="text-xs text-destructive">BGH VIII ZR 224/07 – Schadensersatzanspruch möglich.</p>
            )}

            {/* ── Technische Funktionen (3-Status) ── */}
            <div className="border-t border-border/40 pt-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" /> Technische Funktionen
              </p>

              <TechCheckRow
                label="Rauchwarnmelder – Testknopf-Aktivierung erfolgreich (LBO SH §49)"
                value={room.smokeDetector}
                onChange={v => onUpdate({ smokeDetector: v })}
              />
              <TechCheckRow
                label="Fenster & Türen gängig (§ 538 BGB)"
                value={room.windowsDoors}
                onChange={v => onUpdate({ windowsDoors: v })}
              />
              <TechCheckRow
                label="Sanitär-/Wasseranschlüsse dicht"
                icon={<Droplets className="w-3 h-3 text-muted-foreground shrink-0" />}
                value={room.sanitary}
                onChange={v => onUpdate({ sanitary: v })}
              />
              <TechCheckRow
                label="Steckdosen/Lichtschalter unbeschädigt"
                icon={<Plug className="w-3 h-3 text-muted-foreground shrink-0" />}
                value={room.electrical}
                onChange={v => onUpdate({ electrical: v })}
              />
            </div>

            {/* ── Küche-spezifisch ── */}
            {isKitchen && (
              <div className="border-t border-border/40 pt-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <CookingPot className="w-3.5 h-3.5" /> Küchen-Check
                </p>
                <TechCheckRow
                  label="Herd/Backofen funktionsfähig & sauber"
                  value={room.oven}
                  onChange={v => onUpdate({ oven: v })}
                />
                <TechCheckRow
                  label="Spüle/Abfluss frei"
                  value={room.sinkDrain}
                  onChange={v => onUpdate({ sinkDrain: v })}
                />
              </div>
            )}

            {/* ── Bad-spezifisch ── */}
            {isBathroom && (
              <div className="border-t border-border/40 pt-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Bath className="w-3.5 h-3.5" /> Bad-Check
                </p>
                <TechCheckRow
                  label="Fliesen/Fugen intakt"
                  value={room.tilesGrout}
                  onChange={v => onUpdate({ tilesGrout: v })}
                />
                <TechCheckRow
                  label="Spülung/Armaturen funktionsfähig"
                  value={room.flushFittings}
                  onChange={v => onUpdate({ flushFittings: v })}
                />
              </div>
            )}
          </div>
        )}

        {/* Defect capture actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => openCameraWithGeo('defect')}
            className="h-auto min-h-[4rem] rounded-2xl gap-1.5 text-xs font-semibold flex-col py-3">
            <Camera className="w-5 h-5" />
            <span>{isMoveIn ? 'Zustand erfassen' : 'Mangel-Foto'}</span>
          </Button>
          <Button variant="outline" onClick={() => { setManualType('defect'); setPhase('manual-entry'); }}
            className="h-auto min-h-[4rem] rounded-2xl gap-1.5 text-xs font-semibold flex-col py-3">
            <FileText className="w-5 h-5 text-amber-500" />
            <span>Manuell</span>
          </Button>
        </div>

        {/* Findings for this room */}
        {roomFindings.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Befunde ({roomFindings.length})
            </p>
            {roomFindings.map(f => (
              <motion.div key={f.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className={`glass-card rounded-xl p-3 border ${f.entryType === 'note' ? 'border-primary/20' : 'border-amber-500/20'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {f.photoUrl && (
                      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0"><img src={f.photoUrl} alt="" className="w-full h-full object-cover" /></div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{f.damageType || f.description}</p>
                      {f.locationDetail && <p className="text-[10px] text-muted-foreground flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{f.locationDetail}</p>}
                      {f.legalClassification && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md mt-0.5 inline-block ${
                          f.legalClassification === 'Normalverschleiß' ? 'bg-primary/10 text-primary' : 
                          f.legalClassification === 'Gebrauchsspur' ? 'bg-amber-500/15 text-amber-600' :
                          'bg-destructive/15 text-destructive'
                        }`}>
                          {f.legalClassification}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    {!isMoveIn && f.recommendedWithholding > 0 && (
                      <span className="text-xs font-bold text-primary mr-1">{f.recommendedWithholding} €</span>
                    )}
                    <button onClick={() => deleteFinding(f.id)} className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Total withholding */}
        {!isMoveIn && defects.length > 0 && (
          <div className="glass-card rounded-xl p-3 flex items-center justify-between">
            <span className="text-sm font-semibold">Einbehalt {room.name}</span>
            <span className="text-lg font-bold text-destructive">{totalWithholding} €</span>
          </div>
        )}

        {/* Complete button */}
        <Button
          onClick={onComplete}
          disabled={!canComplete}
          className="w-full h-12 rounded-2xl font-semibold gap-2" size="lg"
        >
          <CheckCircle2 className="w-4 h-4" />
          {room.completed ? 'Raum aktualisiert' : 'Raum abschließen'}
        </Button>
        {!canComplete && (
          <p className="text-xs text-center text-muted-foreground">
            {!hasPhotos ? 'Mindestens ein Übersichtsfoto erforderlich.' : 'Alle technischen Prüfungen müssen abgehakt werden.'}
          </p>
        )}
      </motion.div>
    </div>
  );
});
RoomDetailSheet.displayName = 'RoomDetailSheet';
