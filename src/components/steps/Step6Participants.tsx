import { motion } from 'framer-motion';
import { UserPlus, Camera, ArrowRight, Check, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHandover } from '@/context/HandoverContext';
import { useState, useRef } from 'react';

export const Step6Participants = () => {
  const { data, updateData, setCurrentStep } = useHandover();
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const addParticipant = () => {
    if (!newName.trim()) return;
    const p = {
      id: Date.now().toString(),
      name: newName.trim(),
      role: newRole.trim() || 'Zeuge',
      present: true,
    };
    updateData({ participants: [...data.participants, p] });
    setNewName('');
    setNewRole('');
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
  };

  const handleAttendancePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      updateData({ attendancePhotoUrl: URL.createObjectURL(file) });
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2 text-center">
        Teilnehmer
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-center mb-6 text-sm">
        Wer ist bei der Übergabe anwesend?
      </motion.p>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="w-full max-w-md space-y-4">
        {/* Participant list */}
        <div className="space-y-2">
          {data.participants.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => togglePresence(p.id)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    p.present ? 'bg-success/20 text-success' : 'bg-destructive/10 text-destructive'
                  }`}
                >
                  {p.present ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                </button>
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.role}</p>
                </div>
              </div>
              <button onClick={() => removeParticipant(p.id)} className="text-muted-foreground hover:text-destructive">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>

        {/* Add participant */}
        <div className="flex gap-2">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name" className="rounded-xl bg-secondary/50 border-0" />
          <Input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="Rolle" className="rounded-xl bg-secondary/50 border-0 w-28" />
          <Button onClick={addParticipant} size="icon" className="rounded-xl shrink-0">
            <UserPlus className="w-4 h-4" />
          </Button>
        </div>

        {/* Attendance photo */}
        <div className="glass-card rounded-2xl p-4">
          <p className="text-sm font-medium mb-2">Beweis-Anker</p>
          <p className="text-xs text-muted-foreground mb-3">Foto des Anwesenheitszettels hochladen</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAttendancePhoto} />
          {data.attendancePhotoUrl ? (
            <div className="relative rounded-xl overflow-hidden">
              <img src={data.attendancePhotoUrl} alt="Anwesenheit" className="w-full h-32 object-cover" />
              <div className="absolute top-2 right-2 bg-success/90 rounded-full p-1">
                <Check className="w-3 h-3 text-success-foreground" />
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full rounded-xl gap-2">
              <Camera className="w-4 h-4" />
              Foto aufnehmen
            </Button>
          )}
        </div>

        <Button onClick={() => setCurrentStep(7)} className="w-full h-13 rounded-2xl text-base font-semibold gap-2" size="lg">
          Weiter zur Beweissicherung
          <ArrowRight className="w-5 h-5" />
        </Button>
      </motion.div>
    </div>
  );
};
