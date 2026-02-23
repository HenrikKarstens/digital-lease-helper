import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Plus, Send, Trash2, UserCircle } from 'lucide-react';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';

interface Recipient {
  id: string;
  role: string;
  name: string;
  email: string;
}

interface SendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmSend: (recipients: Recipient[]) => void;
  sending: boolean;
}

export const SendDialog = ({ open, onOpenChange, onConfirmSend, sending }: SendDialogProps) => {
  const { data } = useHandover();
  const { ownerRole, clientRole } = useTransactionLabels();

  const [recipients, setRecipients] = useState<Recipient[]>(() => [
    { id: '1', role: clientRole, name: data.tenantName || '', email: data.tenantEmail || '' },
    { id: '2', role: ownerRole, name: data.landlordName || '', email: data.landlordEmail || '' },
  ]);

  const [warningAcknowledged, setWarningAcknowledged] = useState(false);

  const activeRecipients = recipients.filter(r => r.email.trim() !== '');
  const showWarning = activeRecipients.length < 2 && !warningAcknowledged;
  const canSend = activeRecipients.length >= 1 && (!showWarning || warningAcknowledged);

  const updateRecipient = (id: string, field: keyof Recipient, value: string) => {
    setRecipients(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    setWarningAcknowledged(false);
  };

  const addRecipient = () => {
    setRecipients(prev => [...prev, { id: crypto.randomUUID(), role: 'Beteiligter', name: '', email: '' }]);
  };

  const removeRecipient = (id: string) => {
    setRecipients(prev => prev.filter(r => r.id !== id));
    setWarningAcknowledged(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Protokoll versenden
          </DialogTitle>
          <DialogDescription>
            Wählen Sie die Empfänger des rechtssicheren Übergabeprotokolls.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-2">
          {recipients.map((r, i) => (
            <div key={r.id} className="rounded-xl border border-border p-3 space-y-2 bg-secondary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <UserCircle className="w-3.5 h-3.5" />
                  Empfänger {i + 1} – {r.role}
                </div>
                {i >= 2 && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRecipient(r.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                )}
              </div>
              <Input
                placeholder="Name"
                value={r.name}
                onChange={e => updateRecipient(r.id, 'name', e.target.value)}
                className="h-9 rounded-lg text-sm"
              />
              <Input
                type="email"
                placeholder="E-Mail-Adresse"
                value={r.email}
                onChange={e => updateRecipient(r.id, 'email', e.target.value)}
                className="h-9 rounded-lg text-sm"
              />
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addRecipient} className="w-full rounded-xl gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />
            Weiteren Beteiligten hinzufügen
          </Button>
        </div>

        {/* Legal warning when < 2 recipients */}
        {activeRecipients.length < 2 && !warningAcknowledged && (
          <div className="rounded-xl border-2 border-destructive/40 bg-destructive/5 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-destructive">Achtung: Eingeschränkte Beweiskraft!</p>
                 <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                   Rechtlicher Hinweis: Für die volle Beweiskraft müssen {clientRole} und {ownerRole} eine identische
                   Kopie des Dokuments erhalten (§ 535 BGB). Um eine rechtssichere Dokumentation der Übergabe in der{' '}
                   <span className="font-medium text-foreground">{data.propertyAddress || 'der Immobilie'}</span>{' '}
                   zu gewährleisten, ist der Versand an beide Vertragsparteien zwingend erforderlich.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="destructive"
                size="sm"
                className="rounded-lg text-xs"
                onClick={() => setWarningAcknowledged(true)}
              >
                Trotzdem fortfahren
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg text-xs"
                onClick={addRecipient}
              >
                Empfänger hinzufügen
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">
            Abbrechen
          </Button>
          <Button
            disabled={!canSend || sending}
            onClick={() => onConfirmSend(activeRecipients)}
            className="rounded-xl gap-2"
          >
            {sending ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                Wird versendet…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                An {activeRecipients.length} Empfänger senden
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
