import { useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

export default function DatePicker({
  value,
  onChange
}: {
  value: string; // yyyy-MM-dd
  onChange: (v: string) => void;
}) {
  const selected = useMemo(() => {
    const parts = value.split("-");
    if (parts.length !== 3) return undefined;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return isNaN(d.getTime()) ? undefined : d;
  }, [value]);

  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button className="input text-left" onClick={() => setOpen((v) => !v)}>
        {value}
      </button>
      {open && (
        <div className="absolute z-30 mt-2 rounded-2xl border border-slate-200 bg-white shadow-soft p-3">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(d) => {
              if (!d) return;
              onChange(format(d, "yyyy-MM-dd"));
              setOpen(false);
            }}
            locale={ko}
          />
        </div>
      )}
    </div>
  );
}
