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
  file_id?: string;
  fileId?: string;
}

export interface PatchScoreBody {
  score: SentimentScore;
}

export interface PatchScoreResponse {
  status: "success" | "error";
  message: string;
}

// Backend responses
export interface ClassifiedApiItem {
  id_comment: number;
  id_batch: string;
  comment_clean: string;
  src?: string | null;
  time?: string | null;
  type_comment: number;
}

export interface ClassifiedListApiResponse {
  status: "success" | "error";
  items?: ClassifiedApiItem[];
  message?: string;
}

export interface UpdateClassifiedResponse {
  status: "success" | "error";
  message: string;
}

export interface UploadLabelsResponse {
  status: "success" | "error";
  file_id?: string;
  f1_metric?: number;
  message?: string;
}

export interface BatchSummary {
  id_batch: string;
  time?: string | null;
  f1_metric: number;
}

export interface BatchSummaryResponse {
  status: "success" | "error";
  summary?: BatchSummary;
  message?: string;
}

export interface BatchCountResponse {
  status: "success" | "error";
  file_id?: string;
  total?: number;
  message?: string;
}

export interface SentimentShareResponse {
  status: "success" | "error";
  file_id?: string;
  share?: Record<string, number>;
  message?: string;
}

export interface ReviewSeriesPoint {
  date: string;
  value: number;
}

export interface ReviewSeriesResponse {
  status: "success" | "error";
  file_id?: string;
  series?: ReviewSeriesPoint[];
  message?: string;
}
