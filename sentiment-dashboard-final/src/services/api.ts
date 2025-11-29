import {
  DashboardChart,
  Comment,
  UploadResponse,
  SentimentScore,
  ClassifiedApiItem,
  ClassifiedListApiResponse,
  UpdateClassifiedResponse,
  UploadLabelsResponse,
  BatchSummaryResponse,
  BatchCountResponse,
  SentimentShareResponse,
  ReviewSeriesResponse,
  Granularity,
} from "../types";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

export async function fetchDashboard(fileId: string, granularity: Granularity): Promise<DashboardChart[]> {
  if (!fileId) return [];
  const [series, share] = await Promise.all([
    fetchReviewSeries(fileId, granularity),
    fetchSentimentShare(fileId),
  ]);

  const reviewChart: DashboardChart = {
    metric: "review_count",
    chartType: "line",
    granularity,
    data: series.map((item) => ({ date: item.date, value: item.value })),
  };

  const shareData = ["negative", "neutral", "positive"].map((key) => ({
    date: key,
    value: share[key as keyof typeof share] ?? 0,
  }));

  const sentimentPie: DashboardChart = {
    metric: "share_positive_reviews",
    chartType: "pie",
    granularity,
    data: shareData,
  };

  return [reviewChart, sentimentPie];
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

export async function fetchBatchCount(fileId: string): Promise<number> {
  if (!fileId) throw new Error("file_id is required.");
  const res = await fetch(`${API_BASE}/batch_count?file_id=${encodeURIComponent(fileId)}`);
  const data = await handleJson<BatchCountResponse>(res);
  if (data.status !== "success" || typeof data.total !== "number") {
    throw new Error(data.message || "Failed to fetch batch count.");
  }
  return data.total;
}

export async function fetchSentimentShare(fileId: string): Promise<Record<string, number>> {
  if (!fileId) throw new Error("file_id is required.");
  const res = await fetch(`${API_BASE}/sentiment_share?file_id=${encodeURIComponent(fileId)}`);
  const data = await handleJson<SentimentShareResponse>(res);
  if (data.status !== "success" || !data.share) {
    throw new Error(data.message || "Failed to fetch sentiment share.");
  }
  return data.share;
}

export async function fetchReviewSeries(
  fileId: string,
  granularity: Granularity
): Promise<{ date: string; value: number }[]> {
  if (!fileId) throw new Error("file_id is required.");
  const url = `${API_BASE}/review_series?file_id=${encodeURIComponent(fileId)}&granularity=${granularity}`;
  const res = await fetch(url);
  const data = await handleJson<ReviewSeriesResponse>(res);
  if (data.status !== "success" || !Array.isArray(data.series)) {
    throw new Error(data.message || "Failed to fetch review time series.");
  }
  return data.series;
}
