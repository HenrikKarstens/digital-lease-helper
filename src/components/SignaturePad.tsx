import { useRef, useState, useEffect } from 'react';
import { PenTool, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SignaturePadProps {
  label: string;
  value: string | null;
  onSave: (dataUrl: string) => void;
  onClear?: () => void;
}

export const SignaturePad = ({ label, value, onSave, onClear }: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = 'hsl(var(--foreground))';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setDrawing(true);
    setHasDrawn(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => setDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onClear?.();
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL('image/png'));
  };

  if (value) {
    return (
      <div className="rounded-xl border border-border/40 bg-secondary/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
            <button onClick={clear} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Löschen</button>
          </div>
        </div>
        <img src={value} alt={`Unterschrift ${label}`} className="w-full h-16 object-contain" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-secondary/10 p-3">
      <span className="text-xs text-muted-foreground mb-2 block">{label} – Hier unterschreiben</span>
      <canvas
        ref={canvasRef}
        className="w-full h-24 bg-background/40 rounded-lg border border-border/30 cursor-crosshair touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <div className="flex gap-2 mt-2">
        <Button variant="outline" size="sm" onClick={clear} className="flex-1 rounded-lg text-xs h-8">Löschen</Button>
        <Button size="sm" onClick={save} disabled={!hasDrawn} className="flex-1 rounded-lg text-xs h-8">Bestätigen</Button>
      </div>
    </div>
  );
};
