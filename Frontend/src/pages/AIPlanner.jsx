import { useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const durationWeeks = {
  "1 Month": 4,
  "2 Months": 8,
  "3 Months": 12,
  "6 Months": 24,
};

const phaseTemplates = [
  "Requirement gathering & literature review",
  "System architecture & tech stack setup",
  "Core feature development (Phase 1)",
  "Core feature development (Phase 2)",
  "Integration & testing",
  "UI/UX refinement",
  "Performance optimization",
  "Documentation & final report",
  "Buffer / bug fixing",
  "Final testing & demo prep",
];

function AIPlanner() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [techStack, setTechStack] = useState("");
  const [duration, setDuration] = useState("2 Months");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);

  const handleGenerate = (e) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      alert("Please enter at least a project title and description.");
      return;
    }

    setLoading(true);
    setPlan(null);

    setTimeout(() => {
      const totalWeeks = durationWeeks[duration] || 8;
      const techList = techStack
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const numPhases = Math.min(phaseTemplates.length, totalWeeks);
      const weeksPerPhase = Math.max(1, Math.floor(totalWeeks / numPhases));

      const weeklyPlan = [];
      let weekCursor = 1;

      for (let i = 0; i < numPhases; i++) {
        const startWeek = weekCursor;
        const endWeek = Math.min(totalWeeks, weekCursor + weeksPerPhase - 1);
        weeklyPlan.push({
          range: startWeek === endWeek ? `Week ${startWeek}` : `Week ${startWeek}-${endWeek}`,
          task: phaseTemplates[i],
        });
        weekCursor = endWeek + 1;
      }

      setPlan({
        totalWeeks,
        techList,
        weeklyPlan,
        risk:
          techList.length > 4
            ? "Tech stack is broad for this duration — consider narrowing scope to reduce integration risk."
            : "Tech stack looks manageable for the selected timeline.",
      });

      setLoading(false);
    }, 1200);
  };

  return (
    <DashboardLayout>
      <h1>AI Project Planner 🤖</h1>

      <p className="page-subtitle">
        Generate an intelligent academic project plan based on your tech stack and duration.
      </p>

      <div className="dashboard-card">
        <form onSubmit={handleGenerate}>
          <label>Project Title</label>
          <input
            className="dashboard-input"
            placeholder="Enter project title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <label>Project Description</label>
          <textarea
            className="dashboard-input"
            rows="5"
            placeholder="Describe your project..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <label>Available Technologies</label>
          <input
            className="dashboard-input"
            placeholder="e.g. React, Python, TensorFlow, MongoDB"
            value={techStack}
            onChange={(e) => setTechStack(e.target.value)}
          />

          <label>Project Duration</label>
          <select
            className="dashboard-input"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          >
            <option>1 Month</option>
            <option>2 Months</option>
            <option>3 Months</option>
            <option>6 Months</option>
          </select>

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Analyzing..." : "✨ Generate AI Plan"}
          </button>
        </form>
      </div>

      {loading && (
        <div className="dashboard-card" style={{ marginTop: "1.5rem" }}>
          <p style={{ color: "#888" }}>
            🤖 Analyzing your tech stack ({techStack || "none specified"}) against a{" "}
            {duration} timeline...
          </p>
        </div>
      )}

      {plan && !loading && (
        <div className="dashboard-card" style={{ marginTop: "1.5rem" }}>
          <div className="card-header">
            <h2>Generated Plan — {plan.totalWeeks} Weeks</h2>
          </div>

          {plan.techList.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
              {plan.techList.map((tech, i) => (
                <span
                  key={i}
                  style={{
                    background: "#e0e7ff",
                    borderRadius: "999px",
                    padding: "0.3rem 0.8rem",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                  }}
                >
                  {tech}
                </span>
              ))}
            </div>
          )}

          {plan.weeklyPlan.map((item, i) => (
            <div className="deadline" key={i}>
              <div className="deadline-date">{item.range}</div>
              <div>
                <h3>{item.task}</h3>
              </div>
            </div>
          ))}

          <p style={{ marginTop: "1rem", color: "#555" }}>
            <strong>Risk note:</strong> {plan.risk}
          </p>

          <button
            type="button"
            className="primary-button"
            style={{ marginTop: "0.75rem" }}
            onClick={handleGenerate}
          >
            🔁 Regenerate Plan
          </button>
        </div>
      )}
    </DashboardLayout>
  );
}

export default AIPlanner;