export type SentimentScore = "positive" | "neutral" | "negative";

export type MetricName =
  | "review_count"
  | "DAU"
  | "WAU"
  | "MAU"
  | "share_negative_reviews"
  | "share_neutral_reviews"
  | "share_positive_reviews";

export type Granularity = "day" | "week" | "month";

export interface DashboardPoint {
  date: string; // ISO 8601
  value: number;
}

export interface DashboardChart {
  metric: MetricName;
  chartType: "line" | "bar" | "pie";
  granularity: Granularity;
  data: DashboardPoint[];
}

export interface DateRange {
  from: string;
  to: string;
}

export interface DashboardFilter {
  granularity: Granularity;
  dateRange: DateRange;
}

export interface Comment {
  id: string;
  text: string;
  score: SentimentScore;
  createdAt?: string;
}

export interface UploadResponse {
  status: "success" | "error";
  message: string;
  invalidRows?: number[];
}

export interface PatchScoreBody {
  score: SentimentScore;
}

export interface PatchScoreResponse {
  status: "success" | "error";
  message: string;
}
