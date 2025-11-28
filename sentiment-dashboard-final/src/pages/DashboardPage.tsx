import React, { useEffect, useMemo, useState } from "react";
import {
  DashboardChart,
  DashboardFilter,
  Granularity,
  Comment,
  SentimentScore,
} from "../types";
import {
  fetchDashboard,
  fetchClassified,
  uploadCsv,
  downloadCsv,
  patchCommentScore,
} from "../services/api";
import { ChartGrid } from "../components/ChartGrid";
import { CommentFeed } from "../components/CommentFeed";
import "../dashboard.css";

const todayIso = new Date().toISOString().slice(0, 10);

const defaultFilter: DashboardFilter = {
  granularity: "day",
  dateRange: {
    from: todayIso,
    to: todayIso,
  },
};

type KpiStats = {
  total: number;
  previousTotal: number;
  deltaPercent: number;
};

const DashboardPage: React.FC = () => {
  const [filter, setFilter] = useState<DashboardFilter>(defaultFilter);
  const [charts, setCharts] = useState<DashboardChart[]>([]);
  const [isCommentsOpen, setIsCommentsOpen] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  const [pendingScores, setPendingScores] = useState<
    Record<string, SentimentScore>
  >({});
  const [isSavingScores, setIsSavingScores] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await fetchDashboard(filter);
      setCharts(data);
    })();
  }, [filter]);

  useEffect(() => {
    if (!activeBatchId) return;
    setComments([]);
    (async () => {
      try {
        const data = await fetchClassified(activeBatchId, 50);
        const sorted = [...data].sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return b.createdAt.localeCompare(a.createdAt);
          }
          return 0;
        });
        setComments(sorted);
      } catch (e: any) {
        setUploadMessage(e?.message || "Failed to load comments.");
      }
    })();
  }, [activeBatchId]);

  const reviewChart = useMemo(
    () => charts.find((c) => c.metric === "review_count"),
    [charts]
  );

  const sentimentChart = useMemo(
    () =>
      charts.find(
        (c) => c.metric === "share_positive_reviews" && c.chartType === "pie"
      ),
    [charts]
  );

  const kpiStats: KpiStats | null = useMemo(() => {
    if (!reviewChart || !reviewChart.data.length) return null;
    const total = reviewChart.data.reduce((acc, p) => acc + p.value, 0);
    const previousTotalRaw = total * (0.7 + Math.random() * 0.4); // mock previous period value
    const previousTotal = Math.max(1, Math.round(previousTotalRaw));
    const deltaPercent = ((total - previousTotal) / previousTotal) * 100;
    return {
      total: Math.round(total),
      previousTotal,
      deltaPercent,
    };
  }, [reviewChart]);

  const handleGranularityChange = (g: Granularity) => {
    setFilter((prev) => ({ ...prev, granularity: g }));
  };

  const handleDateChange = (part: "from" | "to", value: string) => {
    setFilter((prev) => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        [part]: value,
      },
    }));
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setUploadMessage(null);
    try {
      const res = await uploadCsv(file);
      if (res.status !== "success") {
        const invalid =
          res.invalidRows && res.invalidRows.length
            ? ` Invalid rows: ${res.invalidRows.join(", ")}.`
            : "";
        throw new Error(`${res.message || "Upload error."}${invalid}`);
      }
      const batchId = res.fileId || (res as any).file_id;
      if (!batchId) {
        throw new Error("file_id not returned by server.");
      }
      setActiveBatchId(batchId);
      setUploadMessage(res.message || "File uploaded and processed.");
    } catch (e) {
      setUploadMessage((e as any)?.message || "Failed to upload file.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async () => {
    try {
      if (!activeBatchId) {
        alert("Upload CSV first to get file_id.");
        return;
      }
      await downloadCsv(activeBatchId);
    } catch (e) {
      alert((e as any)?.message || "Failed to download CSV.");
    }
  };

  const handleLocalScoreChange = (id: string, newScore: SentimentScore) => {
    setPendingScores((prev) => ({
      ...prev,
      [id]: newScore,
    }));
  };

  const handleApplyScores = async () => {
    const entries = Object.entries(pendingScores);
    if (!entries.length) return;
    if (!activeBatchId) {
      alert('Upload CSV first to set file_id.');
      return;
    }
    setIsSavingScores(true);

    setComments((prev) =>
      prev.map((c) => {
        const overridden = pendingScores[c.id];
        return overridden ? { ...c, score: overridden } : c;
      })
    );

    try {
      await Promise.all(
        entries.map(([id, score]) => patchCommentScore(activeBatchId, id, score))
      );
      setPendingScores({});
    } catch (e) {
      alert((e as any)?.message || 'Failed to save labels.');
    } finally {
      setIsSavingScores(false);
    }
  };

  return (
    <div className={`dashboard ${isCommentsOpen ? "dashboard--with-sidebar" : ""}`}>
      <header className="dashboard__header">
        <div>
          <h1 className="dashboard__title">Sentiment Dashboard</h1>
          <p className="dashboard__subtitle">
            Assign sentiment to comments: negative / neutral / positive
          </p>
        </div>
        <button
          className="btn btn--secondary"
          onClick={() => setIsCommentsOpen((prev) => !prev)}
        >
          {isCommentsOpen ? "Hide comments" : "Show comments"}
        </button>
      </header>

      <section className="dashboard__filters">
        <div className="filter-group">
          <span className="filter-label">Granularity:</span>
          {(["day", "week", "month"] as Granularity[]).map((g) => (
            <button
              key={g}
              className={`chip ${filter.granularity === g ? "chip--active" : ""}`}
              onClick={() => handleGranularityChange(g)}
            >
              {g === "day" && "Day"}
              {g === "week" && "Week"}
              {g === "month" && "Month"}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <span className="filter-label">Period:</span>
          <input
            type="date"
            value={filter.dateRange.from}
            onChange={(e) => handleDateChange("from", e.target.value)}
          />
          <span className="filter-separator">to</span>
          <input
            type="date"
            value={filter.dateRange.to}
            onChange={(e) => handleDateChange("to", e.target.value)}
          />
        </div>
      </section>

      <main className="dashboard__main">
        <CommentFeed
          isOpen={isCommentsOpen}
          comments={comments}
          pendingScores={pendingScores}
          onLocalScoreChange={handleLocalScoreChange}
          onApplyChanges={handleApplyScores}
          isSaving={isSavingScores}
        />

        <div className="dashboard__charts-panel">
          {kpiStats && (
            <section className="kpi-card">
              <div className="kpi-card__label">Total comments</div>
              <div className="kpi-card__value">{kpiStats.total}</div>
              <div className="kpi-card__delta">
                {kpiStats.deltaPercent >= 0 ? "+" : ""}
                {kpiStats.deltaPercent.toFixed(1)}% vs previous period
              </div>
            </section>
          )}
          <ChartGrid charts={charts} sentimentChart={sentimentChart} />
        </div>
      </main>

      <footer className="dashboard__footer">
        <div className="upload-group">
          <FileUploadButton onUpload={handleUpload} disabled={isUploading} />
          {uploadMessage && (
            <span className="upload-message">{uploadMessage}</span>
          )}
        </div>
        <button className="btn" onClick={handleDownload}>
          Download classified CSV
        </button>
      </footer>
    </div>
  );
};

type FileUploadButtonProps = {
  onUpload: (file: File) => void;
  disabled?: boolean;
};

const FileUploadButton: React.FC<FileUploadButtonProps> = ({
  onUpload,
  disabled,
}) => {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        alert("Please choose a CSV file.");
        return;
      }
      onUpload(file);
      e.target.value = "";
    }
  };

  return (
    <>
      <button
        className="btn btn--secondary"
        onClick={handleClick}
        disabled={disabled}
      >
        {disabled ? "Uploading..." : "Upload CSV"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={handleChange}
      />
    </>
  );
};

export default DashboardPage;