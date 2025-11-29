import {
  DashboardChart,
  DashboardFilter,
  Comment,
  UploadResponse,
  SentimentScore,
  ClassifiedApiItem,
  ClassifiedListApiResponse,
  UpdateClassifiedResponse,
  UploadLabelsResponse,
  BatchSummaryResponse,
} from "../types";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

// Mock charts remain for now; there is no backend source for them yet.
export async function fetchDashboard(filter: DashboardFilter): Promise<DashboardChart[]> {
  const from = new Date(filter.dateRange.from);
  const to = new Date(filter.dateRange.to);

  const points: DashboardChart["data"] = [];
  const dayMs = 24 * 60 * 60 * 1000;
  let stepMs = dayMs;
  let format: (d: Date) => string = (d) => d.toISOString().slice(0, 10);

  if (filter.granularity === "week") {
    stepMs = 7 * dayMs;
    format = (d) => {
      const year = d.getUTCFullYear();
      const oneJan = new Date(Date.UTC(year, 0, 1));
      const week = Math.ceil(((+d - +oneJan) / dayMs + oneJan.getUTCDay() + 1) / 7);
      return `${year}-W${String(week).padStart(2, "0")}`;
    };
  } else if (filter.granularity === "month") {
    stepMs = 30 * dayMs;
    format = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  for (let t = from.getTime(); t <= to.getTime(); t += stepMs) {
    const d = new Date(t);
    points.push({
      date: format(d),
      value: Math.round(20 + Math.random() * 80),
    });
  }

  const reviewChart: DashboardChart = {
    metric: "review_count",
    chartType: "line",
    granularity: filter.granularity,
    data: points,
  };

  const negative = 20 + Math.random() * 20;
  const neutral = 20 + Math.random() * 30;
  const positive = 100 - negative - neutral;

  const sentimentPie: DashboardChart = {
    metric: "share_positive_reviews",
    chartType: "pie",
    granularity: filter.granularity,
    data: [
      { date: "negative", value: Number(negative.toFixed(1)) },
      { date: "neutral", value: Number(neutral.toFixed(1)) },
      { date: "positive", value: Number(positive.toFixed(1)) },
    ],
  };

  return new Promise((resolve) => {
    setTimeout(() => resolve([reviewChart, sentimentPie]), 400);
  });
}

function typeToScore(type: number): SentimentScore {
  if (type === 2) return "positive";
  if (type === 1) return "neutral";
  return "negative";
}

function scoreToType(score: SentimentScore): number {
  if (score === "positive") return 2;
  if (score === "neutral") return 1;
  return 0;
}

async function handleJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Invalid JSON response (${res.status})`);
  }
  if (!res.ok) {
    const msg = data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export async function uploadCsv(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/upload_csv`, {
    method: "POST",
    body: form,
  });
  const data = await handleJson<UploadResponse>(res);
  if (data.status === "success" && !data.fileId && (data as any).file_id) {
    data.fileId = (data as any).file_id;
  }
  return data;
}

export async function fetchClassified(fileId: string, limit = 50): Promise<Comment[]> {
  if (!fileId) throw new Error("file_id is required.");
  const res = await fetch(`${API_BASE}/classified?file_id=${encodeURIComponent(fileId)}&limit=${limit}`);
  const data = await handleJson<ClassifiedListApiResponse>(res);
  if (data.status !== "success" || !data.items) {
    throw new Error(data.message || "Failed to fetch comments.");
  }
  return data.items.map((item: ClassifiedApiItem) => ({
    id: String(item.id_comment),
    text: item.comment_clean,
    score: typeToScore(item.type_comment),
    createdAt: item.time || undefined,
  }));
}

export async function downloadCsv(fileId: string): Promise<void> {
  if (!fileId) throw new Error("file_id is required.");
  const res = await fetch(`${API_BASE}/export_csv?file_id=${encodeURIComponent(fileId)}`, {
    method: "GET",
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(text);
      msg = parsed?.message || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileId}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function patchCommentScore(
  fileId: string,
  id: string,
  score: SentimentScore
): Promise<UpdateClassifiedResponse> {
  if (!fileId) throw new Error("file_id is required.");
  const payload = {
    file_id: fileId,
    id_comment: Number(id),
    type_comment: scoreToType(score),
  };
  const res = await fetch(`${API_BASE}/classified`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<UpdateClassifiedResponse>(res);
  return data;
}

export async function uploadLabels(fileId: string, file: File): Promise<UploadLabelsResponse> {
  if (!fileId) throw new Error("file_id is required.");
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/upload_labels?file_id=${encodeURIComponent(fileId)}`, {
    method: "POST",
    body: form,
  });
  const data = await handleJson<UploadLabelsResponse>(res);
  return data;
}

export async function fetchBatchSummary(fileId: string): Promise<number | null> {
  if (!fileId) throw new Error("file_id is required.");
  const res = await fetch(`${API_BASE}/batch_summary?file_id=${encodeURIComponent(fileId)}`);
  const data = await handleJson<BatchSummaryResponse>(res);
  if (data.status !== "success" || !data.summary) {
    throw new Error(data.message || "Failed to load batch summary.");
  }
  return typeof data.summary.f1_metric === "number" ? data.summary.f1_metric : null;
}
