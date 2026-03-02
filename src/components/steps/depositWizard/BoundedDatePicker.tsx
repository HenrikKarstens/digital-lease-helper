import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const selected = parseIsoDate(value);
  const min = parseIsoDate(minDate);
  const max = parseIsoDate(maxDate);

  const isDisabledDate = (date: Date) => {
    const d = normalize(date);
    if (min && d < normalize(min)) return true;
    if (max && d > normalize(max)) return true;
    return false;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-between rounded-xl bg-secondary/50 border-0 h-9 text-sm font-normal',
            !value && 'text-muted-foreground',
            hasError && 'ring-2 ring-destructive/50 border-destructive',
            className,
          )}
        >
          {selected ? format(selected, 'dd.MM.yyyy') : <span>{placeholder}</span>}
          <CalendarIcon className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (!date || isDisabledDate(date)) return;
            onChange(toIsoDate(date));
          }}
          disabled={isDisabledDate}
          initialFocus
          className={cn('p-3 pointer-events-auto')}
        />
      </PopoverContent>
    </Popover>
  );
};
