import { motion } from 'framer-motion';
import { PenTool, Shield, CheckCircle2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useRef, useState, useEffect } from 'react';

interface SignaturePadProps {
  label: string;
  value: string | null;
  onSave: (dataUrl: string) => void;
}

const SignaturePad = ({ label, value, onSave }: SignaturePadProps) => {
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

  const endDraw = () => {
    setDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL('image/png'));
  };

  if (value) {
    return (
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">{label}</span>
          <CheckCircle2 className="w-4 h-4 text-success" />
        </div>
        <img src={value} alt="Unterschrift" className="w-full h-20 object-contain bg-secondary/30 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold">{label}</span>
        <PenTool className="w-4 h-4 text-muted-foreground" />
      </div>
      <canvas
        ref={canvasRef}
        className="w-full h-28 bg-secondary/20 rounded-xl border border-border/50 cursor-crosshair touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <div className="flex gap-2 mt-2">
        <Button variant="outline" size="sm" onClick={clear} className="flex-1 rounded-xl text-xs">Löschen</Button>
        <Button size="sm" onClick={save} disabled={!hasDrawn} className="flex-1 rounded-xl text-xs">Bestätigen</Button>
      </div>
    </div>
  );
};

export const Step9Signature = () => {
  const { data, updateData, goToStepById } = useHandover();
  const { ownerRole, clientRole } = useTransactionLabels();
  const bothSigned = data.signatureLandlord && data.signatureTenant;

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2 text-center">
        Unterschriften
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-center mb-6 text-sm">
        Beide Parteien unterschreiben digital
      </motion.p>

      <div className="w-full max-w-md space-y-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <SignaturePad
            label={data.landlordName || ownerRole}
            value={data.signatureLandlord}
            onSave={(url) => {
              // Sync to participant with landlord role
              const updatedParticipants = data.participants.map(p => {
                const r = p.role.toLowerCase();
                if (r.includes('vermieter') || r.includes('verkäufer') || r.includes('eigentümer')) {
                  return { ...p, signature: url };
                }
                return p;
              });
              updateData({ signatureLandlord: url, participants: updatedParticipants });
            }}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <SignaturePad
            label={data.tenantName || clientRole}
            value={data.signatureTenant}
            onSave={(url) => {
              const updatedParticipants = data.participants.map(p => {
                const r = p.role.toLowerCase();
                if (!r.includes('vermieter') && !r.includes('verkäufer') && !r.includes('eigentümer') &&
                    (r.includes('mieter') || r.includes('käufer'))) {
                  return { ...p, signature: url };
                }
                return p;
              });
              updateData({ signatureTenant: url, participants: updatedParticipants });
            }}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="glass-card rounded-2xl p-4 flex items-start gap-3">
          <Lock className="w-5 h-5 text-success shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold mb-1">Manipulationssicher</p>
            <p className="text-xs text-muted-foreground">Dieses Dokument wird mit einem SHA-256 Hashwert fälschungssicher versiegelt. Jede nachträgliche Änderung wird erkannt.</p>
          </div>
        </motion.div>

        {bothSigned && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Button onClick={() => goToStepById('deposit')} className="w-full h-12 rounded-2xl font-semibold gap-2" size="lg">
              <Shield className="w-4 h-4" />
              Weiter zum NK-Check
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
};
