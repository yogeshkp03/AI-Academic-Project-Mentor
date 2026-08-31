import DashboardLayout from "../components/DashboardLayout";

function Tasks() {

  return (
    <DashboardLayout>

      <h1>Tasks 📋</h1>

      <p className="page-subtitle">
        Track your project tasks and deadlines.
      </p>


      <div className="dashboard-card">

        <div className="task-row">
          <span>Literature Survey</span>
          <span className="completed">Completed</span>
        </div>

        <div className="task-row">
          <span>Dataset Collection</span>
          <span className="progress-status">
            In Progress
          </span>
        </div>

        <div className="task-row">
          <span>Model Development</span>
          <span className="pending">Pending</span>
        </div>

        <div className="task-row">
          <span>Testing</span>
          <span className="pending">Pending</span>
        </div>

        <div className="task-row">
          <span>Documentation</span>
          <span className="pending">Pending</span>
        </div>

      </div>

    </DashboardLayout>
  );
}

export default Tasks;