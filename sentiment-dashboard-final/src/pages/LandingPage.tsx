import React from "react";
import { useNavigate } from "react-router-dom";
import "../landing.css";

type Sentiment = "positive" | "neutral" | "negative";

type BlockConfig = {
  sentiment: Sentiment;
  left: string;
  delay: number;
};

const blocks: BlockConfig[] = [
  { sentiment: "positive", left: "6%", delay: 0 },
  { sentiment: "negative", left: "19%", delay: 2.5 },
  { sentiment: "neutral", left: "33%", delay: 4.8 },
  { sentiment: "positive", left: "47%", delay: 1.7 },
  { sentiment: "neutral", left: "62%", delay: 3.4 },
  { sentiment: "negative", left: "76%", delay: 5.1 },
  { sentiment: "positive", left: "88%", delay: 0.9 },
];

const textBySentiment: Record<Sentiment, string> = {
  positive: "Очень удобный сервис, всё работает быстро!",
  neutral: "Сервис нормальный, есть плюсы и минусы.",
  negative: "Поддержка отвечает долго, остался недоволен.",
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="landing">
      <div className="landing__bg-blur">
        {blocks.map((block, i) => (
          <div
            key={i}
            className={`floating-comment floating-comment--${block.sentiment}`}
            style={{ left: block.left, animationDelay: `${block.delay}s` }}
          >
            <div className="floating-comment__pill" />
            <div className="floating-comment__text">
              {textBySentiment[block.sentiment]}
            </div>
          </div>
        ))}
      </div>

      <div className="landing__content">
        <h1 className="landing__title">
          Анализ тональности{" "}
          <span>русскоязычных отзывов</span>
        </h1>
        <p className="landing__subtitle">
          Загружайте CSV с отзывами, отслеживайте настроение пользователей
          и управляйте разметкой в одном интерфейсе.
        </p>
        <button
          className="btn landing__cta"
          onClick={() => navigate("/dashboard")}
        >
          Get Started
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
