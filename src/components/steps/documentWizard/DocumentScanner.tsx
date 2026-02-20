import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, Plus, CheckCircle2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PagePhoto } from './types';

interface Props {
  onComplete: (pages: PagePhoto[]) => void;
}

type ScannerState = 'idle' | 'review';

export const DocumentScanner = ({ onComplete }: Props) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<ScannerState>('idle');
  const [capturedImages, setCapturedImages] = useState<PagePhoto[]>([]);
  const [lastCaptured, setLastCaptured] = useState<PagePhoto | null>(null);

  // Abort any in-flight file reads on unmount
  const cleanup = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // Cleanup on unmount
  useState(() => {
    return () => cleanup();
  });

  const processFile = useCallback((file: File): Promise<PagePhoto> => {
    // Create a new AbortController per batch
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    return new Promise((resolve, reject) => {
      if (controller.signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      const reader = new FileReader();
      const onAbort = () => { reader.abort(); reject(new DOMException('Aborted', 'AbortError')); };
      controller.signal.addEventListener('abort', onAbort);
      reader.onload = e => {
        controller.signal.removeEventListener('abort', onAbort);
        resolve({
          id: crypto.randomUUID(),
          dataUrl: e.target?.result as string,
          mimeType: file.type,
          file,
        });
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }, []);

  const handleCameraCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const photo = await processFile(file);
    setCapturedImages(prev => [...prev, photo]);
    setLastCaptured(photo);
    setState('review');
  }, [processFile]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    e.target.value = '';
    const photos = await Promise.all(Array.from(files).map(processFile));
    const all = [...capturedImages, ...photos];
    setCapturedImages(all);
    onComplete(all);
  }, [capturedImages, processFile, onComplete]);

  const handleAddNextPage = () => {
    setState('idle');
    setLastCaptured(null);
    // Trigger camera again immediately
    setTimeout(() => cameraInputRef.current?.click(), 50);
  };

  const handleFinish = () => {
    onComplete(capturedImages);
  };

  const handleRemovePage = (id: string) => {
    setCapturedImages(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="relative">
      {/* Hidden inputs – strictly separated */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraCapture}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Review overlay – shown after each camera capture */}
      <AnimatePresence>
        {state === 'review' && lastCaptured && (
          <motion.div
            key="review"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-safe pt-6 pb-4 border-b border-border">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Seite aufgenommen</p>
                <h3 className="font-bold text-lg">
                  Seite {capturedImages.length}{' '}
                  <span className="text-muted-foreground font-normal text-sm">von bisher {capturedImages.length}</span>
                </h3>
              </div>
              {/* Page counter badge */}
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-xl">
                {capturedImages.length}
              </div>
            </div>

            {/* Preview of last captured image */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-4 overflow-hidden">
              <motion.img
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                src={lastCaptured.dataUrl}
                alt="Aufgenommene Seite"
                className="max-h-[45vh] w-auto rounded-2xl shadow-lg border border-border object-contain"
              />

              {/* Thumbnail strip of all captured so far */}
              {capturedImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none w-full">
                  {capturedImages.map((p, idx) => (
                    <div key={p.id} className="relative shrink-0">
                      <img
                        src={p.dataUrl}
                        alt={`Seite ${idx + 1}`}
                        className={`w-14 h-18 object-cover rounded-xl border-2 ${
                          p.id === lastCaptured.id ? 'border-primary' : 'border-border'
                        }`}
                        style={{ height: '4.5rem' }}
                      />
                      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <button
                        onClick={() => handleRemovePage(p.id)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="px-4 pb-safe pb-8 space-y-3">
              <Button
                onClick={handleAddNextPage}
                variant="outline"
                className="w-full h-14 rounded-2xl font-semibold gap-2 border-2 border-primary/40 text-primary"
                size="lg"
              >
                <Plus className="w-5 h-5" />
                Nächste Seite scannen
              </Button>
              <Button
                onClick={handleFinish}
                className="w-full h-14 rounded-2xl font-semibold gap-2"
                size="lg"
              >
                <CheckCircle2 className="w-5 h-5" />
                Fertigstellen ({capturedImages.length} {capturedImages.length === 1 ? 'Seite' : 'Seiten'})
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Idle state – capture entry points */}
      {state === 'idle' && (
        <div className="grid grid-cols-1 gap-3">
          {capturedImages.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-2xl px-4 py-3 flex items-center justify-between border border-primary/30"
            >
              <span className="text-sm font-medium">
                {capturedImages.length} {capturedImages.length === 1 ? 'Seite' : 'Seiten'} im Stapel
              </span>
              <Button size="sm" onClick={handleFinish} className="rounded-xl gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Fertigstellen
              </Button>
            </motion.div>
          )}

          {/* Camera button – opens camera directly, no file picker */}
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => cameraInputRef.current?.click()}
            className="glass-card rounded-2xl p-5 flex items-center gap-4 text-left w-full border-2 border-primary/20 hover:border-primary/50 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 relative">
              <Camera className="w-6 h-6 text-primary" />
              {capturedImages.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {capturedImages.length}
                </span>
              )}
            </div>
            <div>
              <h4 className="font-semibold">Foto aufnehmen</h4>
              <p className="text-xs text-muted-foreground">
                {capturedImages.length > 0
                  ? `${capturedImages.length} Seite(n) – weitere aufnehmen`
                  : 'Kamera öffnet direkt – Seite für Seite scannen'}
              </p>
            </div>
          </motion.button>

          {/* Upload button – opens file system, no camera */}
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => fileInputRef.current?.click()}
            className="glass-card rounded-2xl p-5 flex items-center gap-4 text-left w-full hover:border-primary/30 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <Upload className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <h4 className="font-semibold">PDF / Bild hochladen</h4>
              <p className="text-xs text-muted-foreground">PDF, JPG, PNG aus dem Speicher wählen</p>
            </div>
          </motion.button>
        </div>
      )}
    </div>
  );
};

