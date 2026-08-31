import DashboardLayout from "../components/DashboardLayout";

function Analytics() {

  return (
    <DashboardLayout>

      <h1>Project Analytics 📊</h1>

      <p className="page-subtitle">
        Understand your academic project performance.
      </p>


      <div className="stats-grid">

        <div className="stat-card">
          <div>
            <p>Total Tasks</p>
            <h2>25</h2>
          </div>
        </div>

        <div className="stat-card">
          <div>
            <p>Completed</p>
            <h2>18</h2>
          </div>
        </div>

        <div className="stat-card">
          <div>
            <p>Pending</p>
            <h2>7</h2>
          </div>
        </div>

        <div className="stat-card">
          <div>
            <p>Completion</p>
            <h2>72%</h2>
          </div>
        </div>

      </div>


      <div className="dashboard-card">

        <h2>Weekly Progress</h2>

        <div className="progress-chart">

          <div>
            Week 1
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: "40%" }}
              />
            </div>
          </div>

          <div>
            Week 2
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: "55%" }}
              />
            </div>
          </div>

          <div>
            Week 3
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: "72%" }}
              />
            </div>
          </div>

        </div>

      </div>

    </DashboardLayout>
  );
}

export default Analytics;