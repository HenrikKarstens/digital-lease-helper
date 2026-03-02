import { useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface BoundedDatePickerProps {
  value: string; // ISO YYYY-MM-DD
  onChange: (value: string) => void;
  minDate: string; // ISO YYYY-MM-DD
  maxDate: string; // ISO YYYY-MM-DD
  placeholder?: string;
  className?: string;
  hasError?: boolean;
  disabled?: boolean;
}

const parseIsoDate = (value: string): Date | undefined => {
  if (!value || value.length < 10) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
};

const toIsoDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const normalize = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isInRange = (dateStr: string, minStr: string, maxStr: string): boolean => {
  if (!dateStr || dateStr.length < 10) return false;
  if (minStr && dateStr < minStr) return false;
  if (maxStr && dateStr > maxStr) return false;
  return true;
};

export const BoundedDatePicker = ({
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = 'Datum wählen',
  className,
  hasError = false,
  disabled = false,
}: BoundedDatePickerProps) => {
  const [open, setOpen] = useState(false);
  // Local input state allows typing; we only propagate valid values
  const [localInput, setLocalInput] = useState(value);

  // Sync external value → local
  useEffect(() => {
    setLocalInput(value);
  }, [value]);

  const selected = parseIsoDate(value);
  const min = parseIsoDate(minDate);
  const max = parseIsoDate(maxDate);

  const isDisabledDate = useCallback((date: Date) => {
    const d = normalize(date);
    if (min && d < normalize(min)) return true;
    if (max && d > normalize(max)) return true;
    return false;
  }, [min, max]);

  // On every change, update local state; if valid & in range → propagate
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalInput(val);

    if (!val) {
      onChange('');
      return;
    }

    if (isInRange(val, minDate, maxDate)) {
      onChange(val);
    }
    // If out of range, we keep localInput for display but do NOT propagate
  };

  // On blur, snap back to last valid value if current input is invalid
  const handleBlur = () => {
    if (!localInput) {
      onChange('');
      return;
    }
    if (!isInRange(localInput, minDate, maxDate)) {
      // Reset to last valid value (or empty)
      setLocalInput(value);
    }
  };

  const formatHint = (dateStr: string): string => {
    if (!dateStr) return '–';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  };

  return (
    <div className="space-y-1">
      <div className={cn('flex items-center gap-1.5', className)}>
        {/* Manuell editierbares Datumsfeld */}
        <input
          type="date"
          value={localInput}
          min={minDate || undefined}
          max={maxDate || undefined}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            'flex-1 h-9 rounded-xl bg-secondary/50 border-0 px-3 text-sm',
            'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            hasError && 'ring-2 ring-destructive/50',
          )}
        />

        {/* Kalender-Button */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                'h-9 w-9 shrink-0 rounded-xl bg-secondary/50 flex items-center justify-center',
                'hover:bg-secondary/80 transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected || min || new Date()}
              onSelect={(date) => {
                if (!date || isDisabledDate(date)) return;
                const iso = toIsoDate(date);
                onChange(iso);
                setLocalInput(iso);
                setOpen(false);
              }}
              disabled={isDisabledDate}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Erlaubter Bereich als Hinweis */}
      {minDate && maxDate && (
        <p className="text-[10px] text-muted-foreground/60 px-1">
          Erlaubt: {formatHint(minDate)} – {formatHint(maxDate)}
        </p>
      )}
    </div>
  );
};
