import { useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";

function Dashboard() {

  return (

    <DashboardLayout>

      <header className="dashboard-header">
<div>
<h1>
  Good Morning,{" "}
  {localStorage.getItem("userName") || "Student"}! 👋
</h1>
          <p>
            Here's an overview of your academic projects.
          </p>
        </div>

        <div className="profile">
          👩‍🎓 {localStorage.getItem("userName") || "Student"}
        </div>

      </header>


      {/* Statistics */}

      <section className="stats-grid">

        <div className="stat-card">
          <div className="stat-icon blue">📁</div>

          <div>
            <p>Active Projects</p>
            <h2>3</h2>
          </div>
        </div>


        <div className="stat-card">
          <div className="stat-icon green">✅</div>

          <div>
            <p>Completed Tasks</p>
            <h2>18 / 25</h2>
          </div>
        </div>


        <div className="stat-card">
          <div className="stat-icon purple">📊</div>

          <div>
            <p>Overall Progress</p>
            <h2>72%</h2>
          </div>
        </div>


        <div className="stat-card">
          <div className="stat-icon orange">⏰</div>

          <div>
            <p>Upcoming Deadlines</p>
            <h2>4</h2>
          </div>
        </div>

      </section>


      <section className="dashboard-grid">

        {/* Projects */}

        <div className="dashboard-card">

          <div className="card-header">

            <h2>My Projects</h2>

            <Link to="/projects">
              View All →
            </Link>

          </div>


          <div className="project-item">

            <div>
              <h3>🌱 Smart Agriculture AI</h3>

              <p>
                Crop prediction using machine learning
              </p>
            </div>

            <strong>75%</strong>

          </div>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: "75%" }}
            />
          </div>


          <div className="project-item">

            <div>
              <h3>🤖 Autonomous Robot Navigation</h3>

              <p>
                AI-based predictive path planning
              </p>
            </div>

            <strong>60%</strong>

          </div>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: "60%" }}
            />
          </div>


          <div className="project-item">

            <div>
              <h3>💬 AI Academic Assistant</h3>

              <p>
                AI-powered student mentoring system
              </p>
            </div>

            <strong>45%</strong>

          </div>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: "45%" }}
            />
          </div>

        </div>


        {/* Deadlines */}

        <div className="dashboard-card">

          <div className="card-header">
            <h2>Upcoming Deadlines</h2>
          </div>


          <div className="deadline">

            <div className="deadline-date">
              28
              <span>Aug</span>
            </div>

            <div>
              <h3>Literature Survey</h3>
              <p>Smart Agriculture AI</p>
            </div>

          </div>


          <div className="deadline">

            <div className="deadline-date">
              02
              <span>Sep</span>
            </div>

            <div>
              <h3>Dataset Collection</h3>
              <p>Robot Navigation</p>
            </div>

          </div>


          <div className="deadline">

            <div className="deadline-date">
              08
              <span>Sep</span>
            </div>

            <div>
              <h3>Model Development</h3>
              <p>Smart Agriculture AI</p>
            </div>

          </div>

        </div>

      </section>


      {/* AI Recommendation */}

      <section className="ai-recommendation">

        <div className="ai-icon">
          🤖
        </div>

        <div>

          <h2>AI Recommendation</h2>

          <p>
            Your Smart Agriculture project is progressing well.
            Based on your current progress, focus on model
            development before starting documentation.
          </p>

        </div>

        <Link to="/ai-planner">
          View AI Plan →
        </Link>

      </section>

    </DashboardLayout>
  );
}

export default Dashboard;




// import { Link } from "react-router-dom";

// function Dashboard() {
//   return (
//     <div className="dashboard">

//       {/* Sidebar */}
//       <aside className="sidebar">

//         <div className="sidebar-logo">
//           🎓 AI Tracker
//         </div>

//         <nav>

//           <Link to="/dashboard" className="active">
//             🏠 Dashboard
//           </Link>

//           <Link to="/projects">
//             📁 My Projects
//           </Link>

//           <Link to="/tasks">
//             📋 Tasks
//           </Link>

//           <Link to="/ai-planner">
//             🤖 AI Planner
//           </Link>

//           <Link to="/ai-mentor">
//             💬 AI Mentor
//           </Link>

//           <Link to="/analytics">
//             📊 Analytics
//           </Link>

//         </nav>

//         <div className="sidebar-bottom">

//           <Link to="/settings">
//             ⚙️ Settings
//           </Link>

//           <Link to="/">
//             🚪 Logout
//           </Link>

//         </div>

//       </aside>


//       {/* Main Content */}

//       <main className="dashboard-main">

//         {/* Header */}

//         <header className="dashboard-header">

//           <div>
//             <h1>Good Morning, Ashmitha! 👋</h1>

//             <p>
//               Here's an overview of your academic projects.
//             </p>
//           </div>

//           <div className="profile">
//             👩‍🎓
//             <span>Ashmitha</span>
//           </div>

//         </header>


//         {/* Statistics */}

//         <section className="stats-grid">

//           <div className="stat-card">

//             <div className="stat-icon blue">
//               📁
//             </div>

//             <div>
//               <p>Active Projects</p>
//               <h2>3</h2>
//             </div>

//           </div>


//           <div className="stat-card">

//             <div className="stat-icon green">
//               ✅
//             </div>

//             <div>
//               <p>Completed Tasks</p>
//               <h2>18 / 25</h2>
//             </div>

//           </div>


//           <div className="stat-card">

//             <div className="stat-icon purple">
//               📊
//             </div>

//             <div>
//               <p>Overall Progress</p>
//               <h2>72%</h2>
//             </div>

//           </div>


//           <div className="stat-card">

//             <div className="stat-icon orange">
//               ⏰
//             </div>

//             <div>
//               <p>Upcoming Deadlines</p>
//               <h2>4</h2>
//             </div>

//           </div>

//         </section>


//         {/* Main Grid */}

//         <section className="dashboard-grid">


//           {/* Projects */}

//           <div className="dashboard-card projects-card">

//             <div className="card-header">

//               <h2>My Projects</h2>

//               <Link to="/projects">
//                 View All →
//               </Link>

//             </div>


//             <div className="project-item">

//               <div>
//                 <h3>🌱 Smart Agriculture AI</h3>

//                 <p>
//                   Crop prediction using machine learning
//                 </p>
//               </div>

//               <strong>75%</strong>

//             </div>


//             <div className="progress-bar">

//               <div
//                 className="progress-fill"
//                 style={{ width: "75%" }}
//               ></div>

//             </div>


//             <div className="project-item">

//               <div>
//                 <h3>🤖 Autonomous Robot Navigation</h3>

//                 <p>
//                   AI-based predictive path planning
//                 </p>
//               </div>

//               <strong>60%</strong>

//             </div>


//             <div className="progress-bar">

//               <div
//                 className="progress-fill"
//                 style={{ width: "60%" }}
//               ></div>

//             </div>


//             <div className="project-item">

//               <div>
//                 <h3>💬 AI Academic Assistant</h3>

//                 <p>
//                   AI-powered student mentoring system
//                 </p>
//               </div>

//               <strong>45%</strong>

//             </div>


//             <div className="progress-bar">

//               <div
//                 className="progress-fill"
//                 style={{ width: "45%" }}
//               ></div>

//             </div>

//           </div>


//           {/* Deadlines */}

//           <div className="dashboard-card">

//             <div className="card-header">

//               <h2>Upcoming Deadlines</h2>

//             </div>


//             <div className="deadline">

//               <div className="deadline-date">
//                 28
//                 <span>Aug</span>
//               </div>

//               <div>
//                 <h3>Literature Survey</h3>
//                 <p>Smart Agriculture AI</p>
//               </div>

//             </div>


//             <div className="deadline">

//               <div className="deadline-date">
//                 02
//                 <span>Sep</span>
//               </div>

//               <div>
//                 <h3>Dataset Collection</h3>
//                 <p>Robot Navigation</p>
//               </div>

//             </div>


//             <div className="deadline">

//               <div className="deadline-date">
//                 08
//                 <span>Sep</span>
//               </div>

//               <div>
//                 <h3>Model Development</h3>
//                 <p>Smart Agriculture AI</p>
//               </div>

//             </div>

//           </div>


//         </section>


//         {/* AI Recommendation */}

//         <section className="ai-recommendation">

//           <div className="ai-icon">
//             🤖
//           </div>

//           <div>

//             <h2>AI Recommendation</h2>

//             <p>
//               Your Smart Agriculture project is progressing well.
//               Based on your current progress, you should focus on
//               completing model development before starting
//               documentation.
//             </p>

//           </div>

//           <Link to="/ai-planner">
//             View AI Plan →
//           </Link>

//         </section>

//       </main>

//     </div>
//   );
// }

// export default Dashboard;