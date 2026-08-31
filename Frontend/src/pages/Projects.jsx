import { useState, useEffect } from "react";
import DashboardLayout from "../components/DashboardLayout";

function Profile() {
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    college: "",
    branch: "",
    year: "",
  });

  const [skills, setSkills] = useState([]);
  const [skillName, setSkillName] = useState("");
  const [skillLevel, setSkillLevel] = useState("Beginner");

  useEffect(() => {
    const savedProfile = localStorage.getItem("studentProfile");
    const savedSkills = localStorage.getItem("studentSkills");

    if (savedProfile) setProfile(JSON.parse(savedProfile));
    if (savedSkills) setSkills(JSON.parse(savedSkills));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    localStorage.setItem("studentProfile", JSON.stringify(profile));
    localStorage.setItem("userName", profile.name);
    alert("Profile saved!");
  };

  const handleAddSkill = () => {
    if (skillName.trim() === "") return;

    const newSkill = { name: skillName.trim(), level: skillLevel };
    const updatedSkills = [...skills, newSkill];

    setSkills(updatedSkills);
    localStorage.setItem("studentSkills", JSON.stringify(updatedSkills));

    setSkillName("");
    setSkillLevel("Beginner");
  };

  const handleDeleteSkill = (indexToRemove) => {
    const updatedSkills = skills.filter((_, i) => i !== indexToRemove);
    setSkills(updatedSkills);
    localStorage.setItem("studentSkills", JSON.stringify(updatedSkills));
  };

  const levelColor = {
    Beginner: "#fde68a",
    Intermediate: "#93c5fd",
    Advanced: "#86efac",
  };

  return (
    <DashboardLayout>
      <header className="dashboard-header">
        <div>
          <h1>Student Profile</h1>
          <p>Manage your personal information and technical skills.</p>
        </div>
      </header>

      {/* Personal Info */}
      <section className="dashboard-card">
        <div className="card-header">
          <h2>Personal Information</h2>
        </div>

        <form onSubmit={handleSaveProfile} style={{ display: "grid", gap: "1rem" }}>
          <div>
            <label>Full Name</label>
            <input
              type="text"
              name="name"
              value={profile.name}
              onChange={handleChange}
              placeholder="Enter your full name"
              required
            />
          </div>

          <div>
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={profile.email}
              onChange={handleChange}
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label>College</label>
            <input
              type="text"
              name="college"
              value={profile.college}
              onChange={handleChange}
              placeholder="Enter your college name"
            />
          </div>

          <div style={{ display: "flex", gap: "1rem" }}>
            <div style={{ flex: 1 }}>
              <label>Branch</label>
              <input
                type="text"
                name="branch"
                value={profile.branch}
                onChange={handleChange}
                placeholder="e.g. CSE"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>Year</label>
              <select name="year" value={profile.year} onChange={handleChange}>
                <option value="">Select</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </div>
          </div>

          <button type="submit" className="auth-button" style={{ width: "fit-content" }}>
            Save Profile
          </button>
        </form>
      </section>

      {/* Skills */}
      <section className="dashboard-card" style={{ marginTop: "1.5rem" }}>
        <div className="card-header">
          <h2>Technical Skills</h2>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="e.g. React, Python, SQL"
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            style={{ flex: 1, minWidth: "160px" }}
          />

          <select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value)}>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>

          <button type="button" onClick={handleAddSkill} className="auth-button">
            + Add Skill
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {skills.length === 0 && <p style={{ color: "#888" }}>No skills added yet.</p>}

          {skills.map((skill, index) => (
            <div
              key={index}
              style={{
                background: levelColor[skill.level],
                borderRadius: "999px",
                padding: "0.4rem 0.9rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              {skill.name} · {skill.level}
              <button
                onClick={() => handleDeleteSkill(index)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </section>
    </DashboardLayout>
  );
}

export default Profile;