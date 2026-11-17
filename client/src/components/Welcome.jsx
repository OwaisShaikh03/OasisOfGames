import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Tabs from "./Tabs";

// First-visit welcome message in plain language. Reopened from "What is this?" in the menu.
export default function Welcome({ onClose }) {
  const { user } = useAuth();
  const [tab, setTab] = useState("play");

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="welcome-title">Welcome to the Oasis Of Games</h2>
        <p className="lead">
          Some games you play in your web browser take a long time to start, because a big file has to download first.
          This site shows you exactly how fast each game loads, and helps the people who make games to make them faster.
        </p>

        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[["play", "I just want to play"], ["make", "I make games"]]}
        />

        {tab === "play" ? (
          <ul>
            <li>Play games right here in your browser. There is nothing to install.</li>
            <li>See how quickly each game starts, even on a slow, phone-style connection.</li>
            <li>Give games star ratings and leave comments. You need a free account for that, so we know real people are behind the ratings.</li>
          </ul>
        ) : (
          <ul>
            <li>Upload two versions of your Unity WebGL game: the original and an optimized one.</li>
            <li>We run both in a real browser and measure the load time, download size, frame rate and memory, then compare them side by side.</li>
            <li>Set your own size and speed targets, check whether the difference is real or just chance, and get tips on what to improve.</li>
            <li>The Learn page explains how to shrink a build, step by step.</li>
          </ul>
        )}

        <div className="tip">
          <strong>What does "optimized" mean?</strong> It means trimming and compressing a game so it needs less data to
          download, a bit like zipping a big folder before emailing it. A smaller game starts sooner.
        </div>

        <div className="modal-actions">
          {!user && <Link to="/register" onClick={onClose}><button type="button" className="btn-secondary">Create a free account</button></Link>}
          <button type="button" onClick={onClose} autoFocus>Start exploring</button>
        </div>
        <p className="welcome-note">You can open this message again any time from "What is this?" in the menu.</p>
      </div>
    </div>
  );
}