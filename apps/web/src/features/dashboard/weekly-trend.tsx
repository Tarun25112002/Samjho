"use client";

import { useId, useState } from "react";

import type { ActivityDay } from "@/lib/dashboard";

/**
 * The dashboard's seven-day activity chart.
 *
 * This stays deliberately small and dependency-free, but it is not a decorative
 * SVG: hovering or focusing a day updates the real data summary above it, the
 * two lines use distinct stroke and marker systems, and mobile receives a
 * taller chart rather than a compressed desktop graphic.
 */
export function WeeklyTrend({ days }: { days: ActivityDay[] }) {
  const todayIndex = days.findIndex((day) => day.isToday);
  const [activeIndex, setActiveIndex] = useState(todayIndex >= 0 ? todayIndex : days.length - 1);
  const activeDay = days[activeIndex] ?? days.at(-1);
  const chartId = useId().replace(/:/g, "");

  if (activeDay === undefined) return null;

  const accuracy =
    activeDay.answered === 0 ? null : Math.round((activeDay.correct / activeDay.answered) * 100);

  return (
    <figure className="min-w-0" aria-label="Questions attempted and correct answers over the last seven days">
      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-1.5">
        <div>
          <p className="text-text text-sm font-semibold">{activeDay.label}</p>
          <p className="text-text-faint mt-0.5 text-xs">Hover or focus a day to inspect it</p>
        </div>
        <div aria-live="polite" className="flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1 text-sm tabular-nums">
          <span className="text-text font-semibold">{String(activeDay.answered)} attempted</span>
          <span className="text-tick-700 font-semibold">{String(activeDay.correct)} correct</span>
          {accuracy !== null ? <span className="text-text-soft">{String(accuracy)}%</span> : null}
        </div>
      </div>

      <div className="mt-4 sm:hidden">
        <TrendGraphic
          days={days}
          activeIndex={activeIndex}
          id={`${chartId}-mobile`}
          width={390}
          height={220}
          onActiveIndexChange={setActiveIndex}
        />
      </div>
      <div className="mt-4 hidden sm:block">
        <TrendGraphic
          days={days}
          activeIndex={activeIndex}
          id={`${chartId}-desktop`}
          width={760}
          height={160}
          onActiveIndexChange={setActiveIndex}
        />
      </div>

      <ul className="sr-only">
        {days.map((day) => (
          <li key={day.key}>
            {day.label}: {String(day.answered)} attempted, {String(day.correct)} correct.
          </li>
        ))}
      </ul>
    </figure>
  );
}

function TrendGraphic({
  days,
  activeIndex,
  id,
  width,
  height,
  onActiveIndexChange,
}: {
  days: ActivityDay[];
  activeIndex: number;
  id: string;
  width: number;
  height: number;
  onActiveIndexChange: (index: number) => void;
}) {
  const plot = {
    left: width < 500 ? 32 : 42,
    right: 18,
    top: width < 500 ? 20 : 14,
    bottom: width < 500 ? 42 : 34,
  };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const maximum = Math.max(...days.flatMap((day) => [day.answered, day.correct]), 1);
  const high = Math.max(4, Math.ceil(maximum / 2) * 2);
  const x = (index: number) => plot.left + (plotWidth / Math.max(days.length - 1, 1)) * index;
  const y = (value: number) => plot.top + plotHeight - (value / high) * plotHeight;
  const points = (key: "answered" | "correct") =>
    days.map((day, index) => `${String(x(index))},${String(y(day[key]))}`).join(" ");
  const areaPoints = [
    `${String(x(0))},${String(y(days[0]?.answered ?? 0))}`,
    ...days.slice(1).map((day, index) => `${String(x(index + 1))},${String(y(day.answered))}`),
    `${String(x(days.length - 1))},${String(plot.top + plotHeight)}`,
    `${String(x(0))},${String(plot.top + plotHeight)}`,
  ].join(" ");
  const step = plotWidth / Math.max(days.length - 1, 1);
  const activeDay = days[activeIndex];

  return (
    <svg
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      className="block h-auto w-full"
      role="img"
      aria-label="Interactive line chart of questions attempted and correct answers"
    >
      <defs>
        <linearGradient id={`attempted-fill-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0.015" />
        </linearGradient>
      </defs>

      {[high, high / 2, 0].map((value) => (
        <g key={value}>
          <line
            x1={plot.left}
            x2={width - plot.right}
            y1={y(value)}
            y2={y(value)}
            stroke="var(--color-line)"
            strokeDasharray={value === 0 ? "0" : "3 5"}
          />
          <text
            x={plot.left - 8}
            y={y(value) + 4}
            fill="var(--color-text-faint)"
            fontSize={width < 500 ? "10" : "11"}
            fontWeight="600"
            textAnchor="end"
          >
            {String(value)}
          </text>
        </g>
      ))}

      {activeDay ? (
        <line
          x1={x(activeIndex)}
          x2={x(activeIndex)}
          y1={plot.top}
          y2={plot.top + plotHeight}
          stroke="var(--color-brand-200)"
          strokeDasharray="3 5"
          strokeWidth="1.5"
        />
      ) : null}

      <polygon points={areaPoints} fill={`url(#attempted-fill-${id})`} />
      <polyline
        points={points("answered")}
        fill="none"
        stroke="var(--color-brand-500)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={points("correct")}
        fill="none"
        stroke="var(--color-tick-600)"
        strokeWidth="3"
        strokeDasharray="7 6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {days.map((day, index) => {
        const selected = index === activeIndex;
        return (
          <g
            key={day.key}
            tabIndex={0}
            onFocus={() => onActiveIndexChange(index)}
            onMouseEnter={() => onActiveIndexChange(index)}
          >
            <title>
              {day.label}: {String(day.answered)} attempted, {String(day.correct)} correct
            </title>
            <rect
              x={x(index) - step / 2}
              y={plot.top}
              width={step}
              height={plotHeight}
              fill="transparent"
            />
            <circle
              cx={x(index)}
              cy={y(day.answered)}
              r={selected ? 5.25 : 4}
              fill="var(--color-card)"
              stroke="var(--color-brand-500)"
              strokeWidth={selected ? 3.25 : 2.5}
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x={x(index) - (selected ? 4.25 : 3.25)}
              y={y(day.correct) - (selected ? 4.25 : 3.25)}
              width={selected ? 8.5 : 6.5}
              height={selected ? 8.5 : 6.5}
              rx="1.5"
              fill="var(--color-card)"
              stroke="var(--color-tick-600)"
              strokeWidth={selected ? 2.75 : 2.25}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={x(index)}
              y={height - 13}
              fill={selected ? "var(--color-brand-700)" : "var(--color-text-faint)"}
              fontSize={width < 500 ? "10" : "11"}
              fontWeight={selected ? "700" : "600"}
              textAnchor="middle"
            >
              {day.shortLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
