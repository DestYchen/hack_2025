import {
  DashboardChart,
  DashboardFilter,
  Comment,
  UploadResponse,
  PatchScoreResponse,
  SentimentScore,
} from "../types";

// Простые моки, чтобы проект работал без реального бэкенда

const mockComments: Comment[] = [
  {
    id: "1",
    text: "Это отличный продукт, пользуюсь каждый день!",
    score: "positive",
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "2",
    text: "Нормально, но есть, что улучшить.",
    score: "neutral",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "3",
    text: "Совсем не понравилось, деньги на ветер.",
    score: "negative",
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
];

export async function fetchDashboard(
  filter: DashboardFilter
): Promise<DashboardChart[]> {
  const from = new Date(filter.dateRange.from);
  const to = new Date(filter.dateRange.to);

  const points: DashboardChart["data"] = [];

  // шаг зависит от грануляции
  const dayMs = 24 * 60 * 60 * 1000;
  let stepMs = dayMs;
  let format: (d: Date) => string = (d) => d.toISOString().slice(0, 10);

  if (filter.granularity === "week") {
    stepMs = 7 * dayMs;
    format = (d) => {
      const year = d.getUTCFullYear();
      // простой номер недели
      const oneJan = new Date(Date.UTC(year, 0, 1));
      const week = Math.ceil(
        ((+d - +oneJan) / dayMs + oneJan.getUTCDay() + 1) / 7
      );
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

  // одна линейная метрика: количество отзывов
  const reviewChart: DashboardChart = {
    metric: "review_count",
    chartType: "line",
    granularity: filter.granularity,
    data: points,
  };

  // доля нейтральных / позитивных / негативных за период
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

export async function fetchComments(): Promise<Comment[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve([...mockComments]), 300);
  });
}

export async function uploadCsv(_file: File): Promise<UploadResponse> {
  // всегда success в мок-версии
  return new Promise((resolve) => {
    setTimeout(
      () =>
        resolve({
          status: "success",
          message: "Файл принят и отправлен на обработку (mock).",
        }),
      500
    );
  });
}

export async function downloadCsv(): Promise<void> {
  // создаём простой CSV на лету
  const header = "id,text,score\n";
  const lines = mockComments
    .map((c) => `${c.id},"${c.text.replace(/"/g, '""')}",${c.score}`)
    .join("\n");
  const blob = new Blob([header + lines], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sentiment_export_mock.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function patchCommentScore(
  id: string,
  score: SentimentScore
): Promise<PatchScoreResponse> {
  const idx = mockComments.findIndex((c) => c.id === id);
  if (idx !== -1) {
    mockComments[idx].score = score;
  }
  return new Promise((resolve) => {
    setTimeout(
      () =>
        resolve({
          status: "success",
          message: "Оценка обновлена (mock).",
        }),
      200
    );
  });
}
