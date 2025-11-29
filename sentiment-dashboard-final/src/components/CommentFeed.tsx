import React, { useState } from "react";
import { Comment, SentimentScore } from "../types";
import "../comment-feed.css";

interface CommentFeedProps {
  isOpen: boolean;
  comments: Comment[];
  pendingScores: Record<string, SentimentScore>;
  onLocalScoreChange: (id: string, score: SentimentScore) => void;
  onApplyChanges: () => void;
  isSaving: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export const CommentFeed: React.FC<CommentFeedProps> = ({
  isOpen,
  comments,
  pendingScores,
  onLocalScoreChange,
  onApplyChanges,
  isSaving,
  searchQuery,
  onSearchChange,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const hasPending = Object.keys(pendingScores).length > 0;

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <aside className={`comment-feed ${isOpen ? "comment-feed--open" : ""}`}>
      <div className="comment-feed__header">
        <h3>Comments</h3>
        <span className="comment-feed__count">{comments.length}</span>
      </div>

      <div className="comment-feed__list">
        {comments.map((comment) => {
          const isExpanded = expandedId === comment.id;
          const effectiveScore = pendingScores[comment.id] ?? comment.score;

          const createdAt = comment.createdAt ? new Date(comment.createdAt) : null;
          const dateOnly = createdAt
            ? createdAt.toLocaleDateString("ru-RU")
            : null;
          const dateTime = createdAt
            ? createdAt.toLocaleString("ru-RU")
            : null;

          return (
            <div
              key={comment.id}
              className={`comment-item comment-item--${effectiveScore} ${
                isExpanded ? "comment-item--expanded" : ""
              }`}
            >
              <button
                className="comment-item__toggle"
                onClick={() => handleToggle(comment.id)}
              >
                <div className={`score-pill score-pill--${effectiveScore}`} />
                <div className="comment-item__content">
                  <div className="comment-item__text">
                    {isExpanded
                      ? comment.text
                      : comment.text.length > 90
                      ? comment.text.slice(0, 90) + "..."
                      : comment.text}
                  </div>
                  {dateOnly && !isExpanded && (
                    <div className="comment-item__meta">{dateOnly}</div>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="comment-item__details">
                  <div className="comment-item__row">
                    <span className="comment-item__label">ID:</span>
                    <span className="comment-item__value">{comment.id}</span>
                  </div>
                  {dateTime && (
                    <div className="comment-item__row">
                      <span className="comment-item__label">Created at:</span>
                      <span className="comment-item__value">{dateTime}</span>
                    </div>
                  )}
                  <div className="comment-item__row">
                    <span className="comment-item__label">Label:</span>
                    <div className="comment-item__score-select">
                      {(["negative", "neutral", "positive"] as SentimentScore[]).map(
                        (score) => (
                          <button
                            key={score}
                            className={
                              "score-chip " +
                              (effectiveScore === score ? "score-chip--active" : "")
                            }
                            onClick={() => onLocalScoreChange(comment.id, score)}
                          >
                            {score === "negative" && "Negative"}
                            {score === "neutral" && "Neutral"}
                            {score === "positive" && "Positive"}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="comment-feed__footer">
        <button
          className="btn btn--secondary comment-feed__apply"
          onClick={onApplyChanges}
          disabled={!hasPending || isSaving}
        >
          {isSaving ? "Saving..." : "Apply changes"}
        </button>
        <input
          className="comment-feed__input"
          placeholder="Найти комментарий"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
    </aside>
  );
};