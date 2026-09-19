"use client";

import type { MasteryPoint } from "@medhavi/contracts";
import { useId, useState } from "react";

/**
 * Mastery over time, as a line.
 *
 * ## Why a hand-drawn SVG rather than a chart library
 *
 * The same reason the dashboard's weekly chart is one: a charting dependency
 * for two line charts is several hundred kilobytes shipped to a student on a
 * school connection, and none of what it buys — axes, legends, zoom — is
 * wanted here. What is wanted is one line, readable at 360px, that a keyboard
 * can walk along.
 *
 * ## The summary is the tooltip
 *
 * There is no hover card. Focusing or hovering a point updates the live text
 * above the chart, which means the value is announced by a screen reader and is
 * visible on a touch device where hover does not exist. An SVG `<title>` would
 * be neither.
 *
 * ## Days with no work are gaps, not zeroes
 *
 * The API returns a point per day the student actually worked. Filling the
 * quiet days with zero would draw a line that plunges to the floor every
 * weekend and imply a collapse in mastery that did not happen — the student
 * simply did not practise.
 */
export function MasteryTrend({ points }: { points: MasteryPoint[] }) {
  const [activeIndex, setActiveIndex] = useState(points.length - 1);
  const chartId = useId().replace(/:/g, "");
  const summaryId = `${chartId}-summary`;

  const active = points[activeIndex] ?? points.at(-1);
  if (!active || points.length === 0) return null;

  return (
    <figure className="min-w-0" aria-label="Your mastery over the last sixty days">
      <div
        id={summaryId}
        aria-live="polite"
        className="flex flex-wrap items-end justify-between gap-x-5 gap-y-1.5"
      >
        <div>
          <p className="text-text text-sm font-semibold">{formatDay(active.day)}</p>
          <p className="text-text-faint mt-0.5 text-xs">
            Hover or focus a point to inspect that day
          </p>
        </div>
        <div className="flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1 text-sm tabular-nums">
          <span className="text-text font-semibold">
            {Math.round(active.masteryScore * 100)}% of marks
          </span>
          <span className="text-text-soft">
            {active.attempted} {active.attempted === 1 ? "question" : "questions"}
          </span>
        </div>
      </div>

      <TrendLine
        points={points}
        activeIndex={activeIndex}
        summaryId={summaryId}
        onActiveIndexChange={setActiveIndex}
      />
    </figure>
  );
}

const WIDTH = 720;
const HEIGHT = 200;
const PADDING = { top: 16, right: 12, bottom: 24, left: 34 };

function TrendLine({
  points,
  activeIndex,
  summaryId,
  onActiveIndexChange,
}: {
  points: MasteryPoint[];
  activeIndex: number;
  summaryId: string;
  onActiveIndexChange: (index: number) => void;
}) {
  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;

  // A single point has no span to divide by, and would put the only marker at
  // the left edge with nothing to compare it to. Centring it is the honest
  // rendering of "one day's work so far".
  const step = points.length > 1 ? innerWidth / (points.length - 1) : 0;
  const xOf = (index: number) =>
    points.length > 1 ? PADDING.left + index * step : PADDING.left + innerWidth / 2;
  const yOf = (value: number) => PADDING.top + innerHeight * (1 - Math.min(1, Math.max(0, value)));

  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${String(xOf(index))} ${String(yOf(point.masteryScore))}`,
    )
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
      className="mt-4 h-52 w-full"
      role="img"
      aria-describedby={summaryId}
    >
      {[0, 0.5, 1].map((line) => (
        <g key={line}>
          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={yOf(line)}
            y2={yOf(line)}
            className="stroke-line"
            strokeWidth={1}
          />
          <text
            x={PADDING.left - 8}
            y={yOf(line) + 4}
            textAnchor="end"
            className="fill-text-faint text-[11px] tabular-nums"
          >
            {Math.round(line * 100)}
          </text>
        </g>
      ))}

      <path
        d={path}
        fill="none"
        className="stroke-brand-500"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {points.map((point, index) => {
        const active = index === activeIndex;

        return (
          <g key={point.day}>
            {/*
              A generous invisible target over a small visible dot. At sixty
              points the markers are a few pixels apart, and a 4px hit area on a
              touch screen is not a control — it is a coin flip.
            */}
            <circle
              cx={xOf(index)}
              cy={yOf(point.masteryScore)}
              r={Math.max(8, step / 2)}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${formatDay(point.day)}: ${String(Math.round(point.masteryScore * 100))} per cent of marks over ${String(point.attempted)} questions`}
              onMouseEnter={() => {
                onActiveIndexChange(index);
              }}
              onFocus={() => {
                onActiveIndexChange(index);
              }}
              className="focus:outline-none"
            />
            <circle
              cx={xOf(index)}
              cy={yOf(point.masteryScore)}
              r={active ? 5 : 3}
              className={active ? "fill-brand-600" : "fill-brand-400"}
              aria-hidden="true"
            />
          </g>
        );
      })}
    </svg>
  );
}

function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
