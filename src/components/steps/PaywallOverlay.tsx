import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreditCard, Zap, Shield, ArrowRight } from 'lucide-react';
import { useHandover } from '@/context/HandoverContext';
import { useToast } from '@/hooks/use-toast';

interface PaywallOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked: () => void;
  onServiceCheck?: () => void;
}

export const PaywallOverlay = ({ open, onOpenChange, onUnlocked, onServiceCheck }: PaywallOverlayProps) => {
  const { data, updateData } = useHandover();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);

  const isUnlocked = data.paymentStatus === 'paid' || data.serviceCheckStatus === 'completed';

  const handlePayment = () => {
    setProcessing(true);
    setTimeout(() => {
      updateData({ paymentStatus: 'paid' });
      setProcessing(false);
      toast({ title: '✅ Zahlung erfolgreich', description: 'Ihr Protokoll wurde freigeschaltet.' });
      onOpenChange(false);
      onUnlocked();
    }, 2000);
  };

  const handleServiceCheck = () => {
    onOpenChange(false);
    onServiceCheck?.();
  };

  if (isUnlocked) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-primary-foreground">
              <Shield className="w-6 h-6" />
              Protokoll freischalten
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/80 mt-1">
              Ihr Protokoll ist bereit — wählen Sie eine Freischaltungs-Option.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-3">
          <button
            onClick={handlePayment}
            disabled={processing}
            className="w-full rounded-2xl border-2 border-primary/20 hover:border-primary/50 p-4 text-left transition-all hover:shadow-md group disabled:opacity-50"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm">Direkt freischalten</p>
                  <span className="text-lg font-bold text-primary">9,90 €</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Sofortige Freischaltung des vollständigen Protokolls ohne Wasserzeichen. Rechtssicher & druckfertig.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1 group-hover:text-primary transition-colors" />
            </div>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-medium">oder</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            onClick={handleServiceCheck}
            disabled={processing}
            className="w-full rounded-2xl border-2 border-accent/30 hover:border-accent/60 bg-accent/5 p-4 text-left transition-all hover:shadow-md group disabled:opacity-50"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
                <Zap className="w-5 h-5 text-accent-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm">Kostenfrei & Zählerwechsel prüfen</p>
                  <span className="text-sm font-bold text-accent-foreground">0 €</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Wir analysieren deinen Zählerstand und schalten das Protokoll sofort gratis frei, wenn du einen unverbindlichen Tarifvergleich startest.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1 group-hover:text-accent-foreground transition-colors" />
            </div>
          </button>
        </div>

        {processing && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-2xl">
            <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin mb-3" />
            <p className="text-sm font-medium">Wird verarbeitet…</p>
          </div>
        )}

        <div className="px-5 pb-4">
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            Mit der Nutzung akzeptieren Sie unsere AGB und Datenschutzrichtlinie. Der Tarifvergleich ist unverbindlich und kostenlos.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
