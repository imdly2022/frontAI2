import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type DateRangeValue = { from: Date; to: Date };

const startOfDay = (d: Date) => {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
};
const endOfDay = (d: Date) => {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
};

type Preset = { label: string; build: () => DateRangeValue };
const PRESETS: Preset[] = [
  { label: "Today", build: () => { const t = new Date(); return { from: startOfDay(t), to: endOfDay(t) }; } },
  { label: "Yesterday", build: () => { const y = addDays(new Date(), -1); return { from: startOfDay(y), to: endOfDay(y) }; } },
  { label: "Last 7 days", build: () => ({ from: startOfDay(addDays(new Date(), -6)), to: endOfDay(new Date()) }) },
  { label: "Last 30 days", build: () => ({ from: startOfDay(addDays(new Date(), -29)), to: endOfDay(new Date()) }) },
  { label: "This month", build: () => { const n = new Date(); return { from: startOfDay(new Date(n.getFullYear(), n.getMonth(), 1)), to: endOfDay(n) }; } },
  { label: "Last 90 days", build: () => ({ from: startOfDay(addDays(new Date(), -89)), to: endOfDay(new Date()) }) },
];

export function applyPreset(label: string): DateRangeValue | null {
  return PRESETS.find((p) => p.label === label)?.build() ?? null;
}

export function DateRangePicker({
  value,
  onChange,
  className,
  align = "end",
}: {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>({ from: value.from, to: value.to });

  React.useEffect(() => {
    if (open) setDraft({ from: value.from, to: value.to });
  }, [open, value.from, value.to]);

  const label = React.useMemo(() => {
    const sameDay = format(value.from, "yyyy-MM-dd") === format(value.to, "yyyy-MM-dd");
    if (sameDay) return format(value.from, "yyyy-MM-dd");
    return `${format(value.from, "MM-dd")} → ${format(value.to, "MM-dd")}`;
  }, [value.from, value.to]);

  function pick(label: string) {
    const r = applyPreset(label);
    if (!r) return;
    onChange(r);
    setOpen(false);
  }

  function apply() {
    if (draft?.from) {
      onChange({ from: startOfDay(draft.from), to: endOfDay(draft.to ?? draft.from) });
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 justify-start gap-2 border-border/60 bg-background/80 backdrop-blur font-normal",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 opacity-70" />
          <span className="text-sm">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <div className="flex flex-col gap-0 sm:flex-row">
          <div className="flex flex-col gap-1 border-b border-border/60 p-2 sm:border-b-0 sm:border-r sm:w-36">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => pick(p.label)}
                className="rounded-md px-3 py-2 text-left text-sm hover:bg-accent/60"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col">
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={draft}
              onSelect={setDraft}
              defaultMonth={value.from}
              className={cn("p-3 pointer-events-auto")}
            />
            <div className="flex items-center justify-between gap-2 border-t border-border/60 p-2">
              <div className="text-xs text-muted-foreground px-1">
                {draft?.from ? format(draft.from, "yyyy-MM-dd") : "—"}
                {" → "}
                {draft?.to ? format(draft.to, "yyyy-MM-dd") : (draft?.from ? format(draft.from, "yyyy-MM-dd") : "—")}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                <Button size="sm" disabled={!draft?.from} onClick={apply}>Apply</Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function defaultLast30(): DateRangeValue {
  return applyPreset("Last 30 days")!;
}

export function toRangeKey(r: DateRangeValue): [number, number] {
  return [Math.floor(r.from.getTime() / 1000), Math.floor(r.to.getTime() / 1000)];
}
