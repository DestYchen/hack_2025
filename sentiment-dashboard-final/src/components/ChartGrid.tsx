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

const pieColors: Record<string, string> = {
  negative: "#ff4c5b",
  neutral: "#9ca3af",
  positive: "#4ade80",
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
                      fill={pieColors[entry.date] ?? "#4ade80"}
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
