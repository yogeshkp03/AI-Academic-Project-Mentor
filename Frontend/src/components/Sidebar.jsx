import { NavLink, useNavigate } from "react-router-dom";

function Sidebar() {

  const navigate = useNavigate();

  const handleLogout = () => {

    localStorage.removeItem("isLoggedIn");
    navigate("/");
  };

  return (
    <aside className="sidebar">

      <div className="sidebar-logo">
        🎓 AI Tracker
      </div>

      <nav>

        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            isActive ? "active" : ""
          }
        >
          🏠 Dashboard
        </NavLink>

        <NavLink
  to="/profile"
  className={({ isActive }) =>
    isActive ? "active" : ""
  }
>
  👤 Profile
</NavLink>

        <NavLink
          to="/projects"
          className={({ isActive }) =>
            isActive ? "active" : ""
          }
        >
          📁 My Projects
        </NavLink>

        <NavLink
          to="/tasks"
          className={({ isActive }) =>
            isActive ? "active" : ""
          }
        >
          📋 Tasks
        </NavLink>

        <NavLink
          to="/ai-planner"
          className={({ isActive }) =>
            isActive ? "active" : ""
          }
        >
          🤖 AI Planner
        </NavLink>

        <NavLink
          to="/ai-mentor"
          className={({ isActive }) =>
            isActive ? "active" : ""
          }
        >
          💬 AI Mentor
        </NavLink>

        <NavLink
          to="/analytics"
          className={({ isActive }) =>
            isActive ? "active" : ""
          }
        >
          📊 Analytics
        </NavLink>

      </nav>

      <div className="sidebar-bottom">

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            isActive ? "active" : ""
          }
        >
          ⚙️ Settings
        </NavLink>

        <button
          className="logout-button"
          onClick={handleLogout}
        >
          🚪 Logout
        </button>

      </div>

    </aside>
  );
}

export default Sidebar;