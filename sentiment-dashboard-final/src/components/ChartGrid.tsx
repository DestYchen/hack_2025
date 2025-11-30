import React, { useMemo } from "react";
import { DashboardChart } from "../types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import "../chart-grid.css";

const metricLabel: Record<string, string> = {
  review_count: "Всего отзывов",
  negative_review_count: "Негативных отзывов",
  positive_review_count: "Положительных отзывов",
  share_negative_reviews: "Negative share",
  share_neutral_reviews: "Neutral share",
  share_positive_reviews: "Positive share",
};

const lineColors: Record<string, string> = {
  review_count: "#d7ff3f",
  negative_review_count: "#ff5f6d",
  positive_review_count: "#4ade80",
};

const pieGradients: Record<string, { from: string; to: string }> = {
  negative: { from: "#ff4c5b", to: "#7f1d1d" },
  neutral: { from: "#94a3b8", to: "#1f2937" },
  positive: { from: "#4ade80", to: "#0f766e" },
};

interface ChartGridProps {
  charts: DashboardChart[];
  sentimentChart?: DashboardChart;
}

const renderGranularity = (value: DashboardChart["granularity"]) => {
  if (value === "day") return "per day";
  if (value === "week") return "per week";
  if (value === "month") return "per month";
  return "";
};

export const ChartGrid: React.FC<ChartGridProps> = ({ charts, sentimentChart }) => {
  const lineCharts = useMemo(
    () => charts.filter((c) => c.chartType === "line"),
    [charts]
  );

  const donut = sentimentChart;

  return (
    <div className="chart-grid">
      {lineCharts.map((chart) => (
        <div className="chart-card" key={`${chart.metric}-${chart.granularity}`}>
          <div className="chart-card__header">
            <h3 className="chart-card__title">{metricLabel[chart.metric] ?? chart.metric}</h3>
            <span className="chart-card__granularity">{renderGranularity(chart.granularity)}</span>
          </div>
          <div className="chart-card__body">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chart.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={lineColors[chart.metric] ?? "#d7ff3f"}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}

      {donut && (
        <div className="chart-card" key={`${donut.metric}-${donut.granularity}`}>
          <div className="chart-card__header">
            <h3 className="chart-card__title">
              {metricLabel[donut.metric] ?? donut.metric}
            </h3>
            <span className="chart-card__granularity">
              {renderGranularity(donut.granularity)}
            </span>
          </div>
          <div className="chart-card__body chart-card__body--center">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Tooltip />
                <defs>
                  {Object.entries(pieGradients).map(([key, colors]) => (
                    <linearGradient key={key} id={`pie-${key}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={colors.from} stopOpacity={0.8} />
                      <stop offset="100%" stopColor={colors.to} stopOpacity={0.9} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={donut.data}
                  dataKey="value"
                  nameKey="date"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {donut.data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      stroke="none"
                      fill={
                        pieGradients[entry.date]
                          ? `url(#pie-${entry.date})`
                          : `url(#pie-positive)`
                      }
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
