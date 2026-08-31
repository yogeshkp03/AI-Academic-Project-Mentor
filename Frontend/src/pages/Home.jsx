import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home">
      <nav className="navbar">
        <h2>🎓 AI Project Tracker</h2>

        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#about">About</a>
          <button onClick={() => navigate("/login")}>Login</button>
        </div>
      </nav>

      <section className="hero">
        <h1>
          Manage Your Academic Projects
          <br />
          Smarter with AI 🚀
        </h1>

        <p>
          Plan your project, track tasks, monitor progress,
          and get AI-powered mentorship assistance.
        </p>

        <button className="get-started" onClick={() => navigate("/register")}>
          Get Started →
        </button>
      </section>

      <section id="features" className="features">
        <div className="feature-card">
          <h3>🤖 AI Planning</h3>
          <p>Generate a smart project plan and timeline.</p>
        </div>

        <div className="feature-card">
          <h3>📊 Progress Tracking</h3>
          <p>Track tasks, milestones, and project completion.</p>
        </div>

        <div className="feature-card">
          <h3>💬 AI Mentor</h3>
          <p>Get guidance and suggestions for your project.</p>
        </div>
      </section>
    </div>
  );
}

export default Home;












// function Home() {
//   return (
//     <div className="home">
//       <nav className="navbar">
//         <h2>🎓 AI Project Tracker</h2>

//         <div className="nav-links">
//           <a href="#features">Features</a>
//           <a href="#about">About</a>
//           <button>Login</button>
//         </div>
//       </nav>

//       <section className="hero">
//         <h1>
//           Manage Your Academic Projects
//           <br />
//           Smarter with AI 🚀
//         </h1>

//         <p>
//           Plan your project, track tasks, monitor progress,
//           and get AI-powered mentorship assistance.
//         </p>

//         <button className="get-started">
//           Get Started →
//         </button>
//       </section>

//       <section id="features" className="features">
//         <div className="feature-card">
//           <h3>🤖 AI Planning</h3>
//           <p>Generate a smart project plan and timeline.</p>
//         </div>

//         <div className="feature-card">
//           <h3>📊 Progress Tracking</h3>
//           <p>Track tasks, milestones, and project completion.</p>
//         </div>

//         <div className="feature-card">
//           <h3>💬 AI Mentor</h3>
//           <p>Get guidance and suggestions for your project.</p>
//         </div>
//       </section>
//     </div>
//   );
// }

// export default Home;