import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, ArrowRight, Check, X, PenTool, ChevronDown, AlertTriangle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useState } from 'react';
import { SignaturePad } from '@/components/SignaturePad';


/* ── Participant Card (with inline email) ───────────────────────── */
interface ParticipantCardProps {
  p: { id: string; name: string; role: string; present: boolean; signature?: string | null; email?: string };
  index: number;
  openSigId: string | null;
  emailValue: string;
  onTogglePresence: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleSig: (id: string) => void;
  onSaveSignature: (id: string, url: string) => void;
  onClearSignature: (id: string) => void;
  onEmailChange: (id: string, email: string) => void;
  roleLabel?: string;
}

const ParticipantCard = ({
  p, index, openSigId, emailValue,
  onTogglePresence, onRemove, onToggleSig,
  onSaveSignature, onClearSignature, onEmailChange,
}: ParticipantCardProps) => (
  <motion.div
    key={p.id}
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.05 }}
    className="glass-card rounded-2xl overflow-hidden"
  >
    {/* Header row */}
    <div className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onTogglePresence(p.id)}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${
            p.present ? 'bg-success/20 text-success' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {p.present ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
        </button>
        <div>
          <p className="text-sm font-medium">{p.name}</p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">{p.role}</p>
            {p.signature && <span className="text-xs text-success font-medium">· Unterschrift ✓</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onToggleSig(p.id)}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${
            p.signature
              ? 'text-success bg-success/10'
              : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
          }`}
        >
          <PenTool className="w-3 h-3" />
          {p.signature ? 'Sig.' : 'Sign.'}
          <ChevronDown className={`w-3 h-3 transition-transform ${openSigId === p.id ? 'rotate-180' : ''}`} />
        </button>
        <button onClick={() => onRemove(p.id)} className="text-muted-foreground hover:text-destructive p-1 rounded-lg hover:bg-destructive/10 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    {/* Inline email field */}
    <div className="px-4 pb-3">
      <div className="flex items-center gap-2">
        <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <Input
          type="email"
          value={emailValue}
          onChange={e => onEmailChange(p.id, e.target.value)}
          placeholder="E-Mail-Adresse"
          className="rounded-xl bg-secondary/50 border-0 h-8 text-xs"
        />
      </div>
    </div>

    {/* Inline signature pad */}
    <AnimatePresence>
      {openSigId === p.id && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="px-4 pb-4 overflow-hidden"
        >
          <SignaturePad
            label={`${p.name} (${p.role})`}
            value={p.signature ?? null}
            onSave={(url) => onSaveSignature(p.id, url)}
            onClear={() => onClearSignature(p.id)}
          />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Optional – bestätigt Anwesenheit & Identität
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
);

/* ── Confirmation Dialog (forced confirmation) ─────────────────── */
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';


/* ── Main Component ─────────────────────────────────────────────── */
export const Step6Participants = () => {
  const { data, updateData, goToStepById } = useHandover();
  const { ownerRole, clientRole } = useTransactionLabels();
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [openSigId, setOpenSigId] = useState<string | null>(null);
  const [showEmailWarning, setShowEmailWarning] = useState(false);

  const addParticipant = () => {
    if (!newName.trim()) return;
    const p = {
      id: Date.now().toString(),
      name: newName.trim(),
      role: newRole.trim() || 'Zeuge',
      present: true,
      signature: null,
    };
    updateData({ participants: [...data.participants, p] });
    setNewName('');
    setNewRole('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addParticipant();
  };

  const togglePresence = (id: string) => {
    updateData({
      participants: data.participants.map(p =>
        p.id === id ? { ...p, present: !p.present } : p
      ),
    });
  };

  const removeParticipant = (id: string) => {
    updateData({ participants: data.participants.filter(p => p.id !== id) });
    if (openSigId === id) setOpenSigId(null);
  };

  const saveSignature = (id: string, dataUrl: string) => {
    const participant = data.participants.find(p => p.id === id);
    const roleLower = participant?.role.toLowerCase() || '';

    const updates: Partial<typeof data> = {
      participants: data.participants.map(p =>
        p.id === id ? { ...p, signature: dataUrl } : p
      ),
    };

    // Sync to global signature fields for Phase 9+ (check vermieter BEFORE mieter)
    if (roleLower.includes('vermieter') || roleLower.includes('verkäufer') || roleLower.includes('eigentümer')) {
      updates.signatureLandlord = dataUrl;
    } else if (roleLower.includes('mieter') || roleLower.includes('käufer')) {
      updates.signatureTenant = dataUrl;
    }

    updateData(updates);
    setOpenSigId(null);
  };

  const clearSignature = (id: string) => {
    const participant = data.participants.find(p => p.id === id);
    const roleLower = participant?.role.toLowerCase() || '';

    const updates: Partial<typeof data> = {
      participants: data.participants.map(p =>
        p.id === id ? { ...p, signature: null } : p
      ),
    };

    if (roleLower.includes('vermieter') || roleLower.includes('verkäufer') || roleLower.includes('eigentümer')) {
      updates.signatureLandlord = null;
    } else if (roleLower.includes('mieter') || roleLower.includes('käufer')) {
      updates.signatureTenant = null;
    }

    updateData(updates);
  };

  /** Resolve email for a participant – check 'vermieter' BEFORE 'mieter' (since 'vermieter' contains 'mieter') */
  const getEmailForParticipant = (p: { id: string; name: string; role: string; email?: string }) => {
    const roleLower = p.role.toLowerCase();
    // IMPORTANT: Check vermieter/verkäufer FIRST – 'vermieter' contains 'mieter'!
    if (roleLower.includes('vermieter') || roleLower.includes('verkäufer') || roleLower.includes('eigentümer')) return data.landlordEmail || '';
    if (roleLower.includes('mieter') || roleLower.includes('käufer')) return data.tenantEmail || '';
    return p.email || '';
  };

  const handleEmailChange = (id: string, email: string) => {
    const participant = data.participants.find(p => p.id === id);
    if (!participant) return;
    const roleLower = participant.role.toLowerCase();

    // IMPORTANT: Check vermieter/verkäufer FIRST – 'vermieter' contains 'mieter'!
    if (roleLower.includes('vermieter') || roleLower.includes('verkäufer') || roleLower.includes('eigentümer')) {
      updateData({ landlordEmail: email });
    } else if (roleLower.includes('mieter') || roleLower.includes('käufer')) {
      updateData({ tenantEmail: email });
    }

    // Also store on participant
    updateData({
      participants: data.participants.map(p =>
        p.id === id ? { ...p, email } : p
      ),
    });
  };

  const signedCount = data.participants.filter(p => p.signature).length;

  // Collect valid unique emails
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const landlordEmail = data.landlordEmail?.trim() || '';
  const tenantEmail = data.tenantEmail?.trim() || '';
  const hasValidLandlord = emailRegex.test(landlordEmail);
  const hasValidTenant = emailRegex.test(tenantEmail);
  const validEmailCount = [hasValidLandlord, hasValidTenant].filter(Boolean).length;
  const emailsIdentical = hasValidLandlord && hasValidTenant && landlordEmail.toLowerCase() === tenantEmail.toLowerCase();

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2 text-center">
        Teilnehmer
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-center mb-6 text-sm">
        Anwesenheit erfassen & optional direkt unterschreiben
      </motion.p>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="w-full max-w-md space-y-4">

        {/* Signature summary badge */}
        {data.participants.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <PenTool className="w-3.5 h-3.5" />
            <span>
              {signedCount === 0
                ? 'Noch keine Unterschriften – optional, jederzeit nachholbar'
                : `${signedCount} von ${data.participants.length} Teilnehmern haben unterschrieben`}
            </span>
          </div>
        )}

        {/* Participant cards with integrated email */}
        <div className="space-y-2">
          {data.participants.map((p, i) => (
            <ParticipantCard
              key={p.id}
              p={p}
              index={i}
              openSigId={openSigId}
              emailValue={getEmailForParticipant(p)}
              onTogglePresence={togglePresence}
              onRemove={removeParticipant}
              onToggleSig={(id) => setOpenSigId(openSigId === id ? null : id)}
              onSaveSignature={saveSignature}
              onClearSignature={clearSignature}
              onEmailChange={handleEmailChange}
            />
          ))}
        </div>

        {/* Add participant */}
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Name"
            className="rounded-xl bg-secondary/50 border-0"
          />
          <Input
            value={newRole}
            onChange={e => setNewRole(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Rolle"
            className="rounded-xl bg-secondary/50 border-0 w-28"
          />
          <Button onClick={addParticipant} size="icon" className="rounded-xl shrink-0">
            <UserPlus className="w-4 h-4" />
          </Button>
        </div>

        {/* Duplicate email error – only when both are filled but identical */}
        {emailsIdentical && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-4"
          >
            <div className="flex items-start gap-2">
              <X className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-destructive">Identische E-Mail-Adressen</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {ownerRole} und {clientRole} müssen unterschiedliche E-Mail-Adressen haben, um eine rechtssichere Zustellung an beide Parteien zu garantieren.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Legal warning – ONLY when fewer than 2 emails are provided (0 or 1) */}
        {!emailsIdentical && validEmailCount < 2 && data.participants.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="rounded-2xl border-2 border-amber-400/40 bg-amber-50 dark:bg-amber-950/20 p-4"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-amber-700 dark:text-amber-300">Rechtlicher Hinweis (§ 535 BGB)</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {validEmailCount === 0
                    ? `Es wurde keine E-Mail-Adresse hinterlegt. Für die volle Beweiskraft müssen ${clientRole} und ${ownerRole} jeweils eine Kopie des Protokolls erhalten.`
                    : `Es wurde nur eine E-Mail-Adresse hinterlegt. Für die volle Beweiskraft müssen ${clientRole} und ${ownerRole} jeweils eine identische Kopie des Dokuments erhalten.`
                  }
                </p>
              </div>
            </div>
          </motion.div>
        )}


        {/* Confirmation dialog for proceeding with incomplete emails */}
        <AlertDialog open={showEmailWarning} onOpenChange={setShowEmailWarning}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Unvollständige E-Mail-Adressen
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-relaxed">
                Möchten Sie wirklich mit nur einer E-Mail-Adresse fortfahren? Dies kann die Beweiskraft
                Ihres Protokolls für das Objekt in{' '}
                <span className="font-medium text-foreground">
                  {data.propertyAddress || 'Weddingstedter Straße 39, 25746 Heide'}
                </span>{' '}
                einschränken.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Zurück</AlertDialogCancel>
              <AlertDialogAction
                className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { setShowEmailWarning(false); goToStepById('room-dashboard'); }}
              >
                Trotzdem fortfahren
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          disabled={emailsIdentical}
          onClick={() => {
            if (emailsIdentical) return;
            if (!hasValidLandlord || !hasValidTenant) {
              setShowEmailWarning(true);
              return;
            }
            goToStepById(data.handoverDirection === 'move-out' ? 'condition-check' : 'evidence');
          }}
          className="w-full h-13 rounded-2xl text-base font-semibold gap-2"
          size="lg"
        >
          Weiter zur Beweissicherung
          <ArrowRight className="w-5 h-5" />
        </Button>
      </motion.div>
    </div>
  );
};
