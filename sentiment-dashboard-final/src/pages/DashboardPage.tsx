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
  uploadLabels,
  fetchBatchSummary,
  fetchBatchCount,
} from "../services/api";
import { ChartGrid } from "../components/ChartGrid";
import { CommentFeed } from "../components/CommentFeed";
import { DateRangePicker } from "../components/DateRangePicker";
import "../dashboard.css";

const todayIso = new Date().toISOString().slice(0, 10);

const defaultFilter: DashboardFilter = {
  granularity: "day",
  dateRange: {
    from: todayIso,
    to: todayIso,
  },
};

const BATCH_STORAGE_KEY = "activeBatchId";

const DashboardPage: React.FC = () => {
  const [filter, setFilter] = useState<DashboardFilter>(defaultFilter);
  const [charts, setCharts] = useState<DashboardChart[]>([]);
  const [isCommentsOpen, setIsCommentsOpen] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [f1Metric, setF1Metric] = useState<number | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [pendingScores, setPendingScores] = useState<Record<string, SentimentScore>>({});
  const [isSavingScores, setIsSavingScores] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [totalComments, setTotalComments] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(BATCH_STORAGE_KEY);
    if (stored) {
      setActiveBatchId(stored);
    }
  }, []);

  useEffect(() => {
    if (!activeBatchId) {
      setCharts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchDashboard(activeBatchId, filter.granularity);
        if (!cancelled) {
          setCharts(data);
        }
      } catch (e) {
        if (!cancelled) {
          setCharts([]);
          setUploadMessage((e as any)?.message || "Failed to load dashboard data.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter.granularity, filter.dateRange.from, filter.dateRange.to, activeBatchId]);

  useEffect(() => {
    if (!activeBatchId) return;
    (async () => {
      try {
        const val = await fetchBatchSummary(activeBatchId);
        if (val !== null) setF1Metric(val);
      } catch {
        // ignore summary errors
      }
    })();
  }, [activeBatchId]);

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

  const clearStoredBatch = (message?: string) => {
    if (message) {
      setUploadMessage(message);
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(BATCH_STORAGE_KEY);
    }
    setActiveBatchId(null);
    setCharts([]);
    setComments([]);
    setTotalComments(0);
    setF1Metric(null);
    setValidationMessage(null);
    setPendingScores({});
  };

  useEffect(() => {
    if (!activeBatchId) {
      setTotalComments(0);
      return;
    }
    (async () => {
      try {
        const total = await fetchBatchCount(activeBatchId);
        setTotalComments(total);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(BATCH_STORAGE_KEY, activeBatchId);
        }
      } catch (e) {
        setTotalComments(0);
        clearStoredBatch(
          (e as any)?.message || "Stored batch is unavailable. Please upload the CSV again."
        );
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

  const filteredComments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return comments;
    return comments.filter((c) => c.text.toLowerCase().includes(q));
  }, [comments, searchQuery]);

  const f1Display = useMemo(() => {
    if (f1Metric === null) return "No F1 metric";
    return `F1 (macro): ${f1Metric.toFixed(3)}`;
  }, [f1Metric]);

  const handleGranularityChange = (g: Granularity) => {
    setFilter((prev) => ({ ...prev, granularity: g }));
  };

  const handleDateRangeChange = (range: { from: string; to: string }) => {
    setFilter((prev) => ({
      ...prev,
      dateRange: {
        from: range.from,
        to: range.to,
      },
    }));
    if (range.from && range.to) {
      setIsCalendarOpen(false);
    }
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
      if (typeof window !== "undefined") {
        window.localStorage.setItem(BATCH_STORAGE_KEY, batchId);
      }
      setUploadMessage(res.message || "File uploaded and processed.");
      setF1Metric(null);
      setValidationMessage(null);
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

  const handleUploadValidation = async (file: File) => {
    if (!activeBatchId) {
      alert("Upload CSV first to get file_id.");
      return;
    }
    setValidationMessage(null);
    try {
      const res = await uploadLabels(activeBatchId, file);
      if (res.status !== "success" || typeof res.f1_metric !== "number") {
        throw new Error(res.message || "Failed to evaluate labels.");
      }
      setF1Metric(res.f1_metric);
      setValidationMessage(`F1 (macro): ${res.f1_metric.toFixed(3)}`);
    } catch (e) {
      setValidationMessage((e as any)?.message || "Failed to upload validation CSV.");
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
      alert("Upload CSV first to set file_id.");
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
      alert((e as any)?.message || "Failed to save labels.");
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
      </header>

      <section className="dashboard__filters">
        <div className="filter-group filter-group--actions">
          <button
            className="btn btn--secondary"
            onClick={() => setIsCommentsOpen((prev) => !prev)}
          >
            {isCommentsOpen ? "Hide comments" : "Show comments"}
          </button>
        </div>
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
        <div className="filter-group filter-group--wide">
          <span className="filter-label">Period:</span>
          <div className="date-range-trigger">
            <button
              className="btn btn--secondary"
              onClick={() => setIsCalendarOpen((prev) => !prev)}
            >
              {filter.dateRange.from && filter.dateRange.to
                ? `${filter.dateRange.from} -> ${filter.dateRange.to}`
                : "Select range"}
            </button>
            {isCalendarOpen && (
              <div className="date-range-popover">
                <DateRangePicker value={filter.dateRange} onChange={handleDateRangeChange} />
                <button className="chip" onClick={() => setIsCalendarOpen(false)}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="dashboard__main">
        <CommentFeed
          isOpen={isCommentsOpen}
          comments={filteredComments}
          pendingScores={pendingScores}
          onLocalScoreChange={handleLocalScoreChange}
          onApplyChanges={handleApplyScores}
          isSaving={isSavingScores}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <div className="dashboard__charts-panel">
          <section className="kpi-card">
            <div className="kpi-card__label">Total comments</div>
            <div className="kpi-card__value">{totalComments}</div>
            <div className="kpi-card__delta">
              {activeBatchId ? "Loaded from current batch" : "Upload CSV to start"}
            </div>
          </section>
          {reviewChart && (
            <section className="kpi-card">
              <div className="kpi-card__label">Validation F1</div>
              <div className="kpi-card__value">{f1Display}</div>
            </section>
          )}
          {activeBatchId ? (
            <ChartGrid charts={charts} sentimentChart={sentimentChart} />
          ) : (
            <div className="chart-card chart-card--placeholder">
              <p>Upload and process a CSV file to see sentiment distribution.</p>
            </div>
          )}
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
        <div className="upload-group">
          <FileUploadButton
            onUpload={handleUploadValidation}
            disabled={!activeBatchId}
            label="Upload validation CSV"
          />
          {validationMessage && (
            <span className="upload-message">{validationMessage}</span>
          )}
          {f1Metric !== null && (
            <span className="upload-message">F1 (macro): {f1Metric.toFixed(3)}</span>
          )}
        </div>
      </footer>
    </div>
  );
};

type FileUploadButtonProps = {
  onUpload: (file: File) => void;
  disabled?: boolean;
  label?: string;
};

const FileUploadButton: React.FC<FileUploadButtonProps> = ({
  onUpload,
  disabled,
  label,
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
        {label ? (disabled ? `${label} (disabled)` : label) : disabled ? "Uploading..." : "Upload CSV"}
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
