import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface BoundedDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  minDate: string;
  maxDate: string;
  placeholder?: string;
  className?: string;
  hasError?: boolean;
  disabled?: boolean;
}

const parseIsoDate = (value: string): Date | undefined => {
  if (!value) return undefined;
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
  const selected = parseIsoDate(value);
  const min = parseIsoDate(minDate);
  const max = parseIsoDate(maxDate);

  const isDisabledDate = (date: Date) => {
    const d = normalize(date);
    if (min && d < normalize(min)) return true;
    if (max && d > normalize(max)) return true;
    return false;
  };

  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      onChange('');
      return;
    }
    // Native date input already restricts via min/max, but double-check
    if ((minDate && val < minDate) || (maxDate && val > maxDate)) {
      return; // reject silently
    }
    onChange(val);
  };

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {/* Manuell editierbares Datumsfeld mit harten Grenzen */}
      <input
        type="date"
        value={value}
        min={minDate || undefined}
        max={maxDate || undefined}
        onChange={handleManualInput}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          'flex-1 h-9 rounded-xl bg-secondary/50 border-0 px-3 text-sm',
          'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          hasError && 'ring-2 ring-destructive/50',
        )}
      />

      {/* Kalender-Button als Zusatz */}
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
              onChange(toIsoDate(date));
              setOpen(false);
            }}
            disabled={isDisabledDate}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
