import React, { useMemo, useState } from "react";
import "../date-range.css";

type Range = {
  from: string;
  to: string;
};

type PresetKey = "today" | "last7" | "last30" | "thisMonth" | "prevMonth";

const presets: Record<PresetKey, string> = {
  today: "Сегодня",
  last7: "Последние 7 дней",
  last30: "Последние 30 дней",
  thisMonth: "Текущий месяц",
  prevMonth: "Прошлый месяц",
};

function toISODate(date: Date): string {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return new Date(utc).toISOString().slice(0, 10);
}

function addMonths(date: Date, delta: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + delta);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getDaysGrid(month: Date): Date[] {
  const start = startOfMonth(month);
  const startWeekday = (start.getDay() + 6) % 7; // Monday=0
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const grid: Date[] = [];
  for (let i = 0; i < startWeekday; i++) {
    grid.push(new Date(NaN));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push(new Date(month.getFullYear(), month.getMonth(), d));
  }
  return grid;
}

function isValidDate(d: Date): boolean {
  return !Number.isNaN(d.getTime());
}

function inRange(date: Date, from?: Date, to?: Date): boolean {
  if (!from || !to) return false;
  const ts = date.getTime();
  return ts >= from.getTime() && ts <= to.getTime();
}

function sameDay(a?: Date, b?: Date): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type Props = {
  value: Range;
  onChange: (range: Range) => void;
};

export const DateRangePicker: React.FC<Props> = ({ value, onChange }) => {
  const initialMonth = useMemo(() => {
    if (value.from) return new Date(value.from);
    return new Date();
  }, [value.from]);

  const [month, setMonth] = useState<Date>(initialMonth);

  const fromDate = value.from ? new Date(value.from) : undefined;
  const toDate = value.to ? new Date(value.to) : undefined;

  const grids = useMemo(() => {
    const first = startOfMonth(month);
    const second = startOfMonth(addMonths(month, 1));
    return [getDaysGrid(first), getDaysGrid(second)];
  }, [month]);

  const handleDayClick = (date: Date) => {
    if (!isValidDate(date)) return;
    if (!fromDate || (fromDate && toDate)) {
      onChange({ from: toISODate(date), to: "" });
      return;
    }
    if (date < fromDate) {
      onChange({ from: toISODate(date), to: toISODate(fromDate) });
    } else {
      onChange({ from: toISODate(fromDate), to: toISODate(date) });
    }
  };

  const applyPreset = (key: PresetKey) => {
    const now = new Date();
    let from: Date;
    let to: Date;
    switch (key) {
      case "today":
        from = to = now;
        break;
      case "last7":
        to = now;
        from = new Date(now);
        from.setDate(to.getDate() - 6);
        break;
      case "last30":
        to = now;
        from = new Date(now);
        from.setDate(to.getDate() - 29);
        break;
      case "thisMonth":
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = now;
        break;
      case "prevMonth":
        const prev = addMonths(now, -1);
        from = new Date(prev.getFullYear(), prev.getMonth(), 1);
        to = new Date(prev.getFullYear(), prev.getMonth() + 1, 0);
        break;
      default:
        from = to = now;
    }
    onChange({ from: toISODate(from), to: toISODate(to) });
    setMonth(from);
  };

  return (
    <div className="date-range">
      <div className="date-range__presets">
        {Object.entries(presets).map(([key, label]) => (
          <button key={key} className="chip" onClick={() => applyPreset(key as PresetKey)}>
            {label}
          </button>
        ))}
      </div>
      <div className="date-range__calendars">
        {[0, 1].map((idx) => {
          const grid = grids[idx];
          const currentMonth = addMonths(month, idx);
          const monthLabel = currentMonth.toLocaleDateString("ru-RU", {
            month: "long",
            year: "numeric",
          });
          return (
            <div className="calendar" key={idx}>
              <div className="calendar__header">
                {idx === 0 ? (
                  <button className="calendar__nav" onClick={() => setMonth(addMonths(month, -1))}>
                    ←
                  </button>
                ) : (
                  <span />
                )}
                <span className="calendar__title">{monthLabel}</span>
                {idx === 1 ? (
                  <button className="calendar__nav" onClick={() => setMonth(addMonths(month, 1))}>
                    →
                  </button>
                ) : (
                  <span />
                )}
              </div>
              <div className="calendar__weekdays">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="calendar__grid">
                {grid.map((day, i) => {
                  if (!isValidDate(day)) {
                    return <span key={i} className="day day--empty" />;
                  }
                  const selected =
                    sameDay(day, fromDate) || sameDay(day, toDate) || inRange(day, fromDate, toDate);
                  const isStart = sameDay(day, fromDate);
                  const isEnd = sameDay(day, toDate);
                  return (
                    <button
                      key={i}
                      className={`day ${selected ? "day--selected" : ""} ${
                        isStart || isEnd ? "day--edge" : ""
                      }`}
                      onClick={() => handleDayClick(day)}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="date-range__footer">
        <div className="date-range__selected">
          <span>{value.from || "—"}</span>
          <span>→</span>
          <span>{value.to || "—"}</span>
        </div>
        <button className="chip" onClick={() => onChange({ from: "", to: "" })}>
          Сбросить
        </button>
      </div>
    </div>
  );
};
