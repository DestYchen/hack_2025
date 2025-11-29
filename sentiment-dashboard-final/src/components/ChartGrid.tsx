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
  review_count: "Количество отзывов",
  DAU: "DAU",
  WAU: "WAU",
  MAU: "MAU",
  share_negative_reviews: "Доля негативных",
  share_neutral_reviews: "Доля нейтральных",
  share_positive_reviews: "Доля отзывов по тональности",
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

export const ChartGrid: React.FC<ChartGridProps> = ({ charts, sentimentChart }) => {
  const reviewChart = useMemo(
    () => charts.find((c) => c.metric === "review_count"),
    [charts]
  );

  const donut = sentimentChart;

  return (
    <div className="chart-grid">
      {reviewChart && (
        <div
          className="chart-card"
          key={`${reviewChart.metric}-${reviewChart.granularity}`}
        >
          <div className="chart-card__header">
            <h3 className="chart-card__title">
              {metricLabel[reviewChart.metric] ?? reviewChart.metric}
            </h3>
            <span className="chart-card__granularity">
              {reviewChart.granularity === "day" && "по дням"}
              {reviewChart.granularity === "week" && "по неделям"}
              {reviewChart.granularity === "month" && "по месяцам"}
            </span>
          </div>
          <div className="chart-card__body">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={reviewChart.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#d7ff3f"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {donut && (
        <div
          className="chart-card"
          key={`${donut.metric}-${donut.granularity}`}
        >
          <div className="chart-card__header">
            <h3 className="chart-card__title">
              {metricLabel[donut.metric] ?? donut.metric}
            </h3>
            <span className="chart-card__granularity">
              {donut.granularity === "day" && "за период (день)"}
              {donut.granularity === "week" && "за период (неделя)"}
              {donut.granularity === "month" && "за период (месяц)"}
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
                          : pieGradients.positive
                          ? `url(#pie-positive)`
                          : "#4ade80"
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
