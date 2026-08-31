import DashboardLayout from "../components/DashboardLayout";

function Settings() {

  return (
    <DashboardLayout>

      <h1>Settings ⚙️</h1>

      <p className="page-subtitle">
        Manage your account and preferences.
      </p>


      <div className="dashboard-card">

        <h2>Profile Information</h2>

        <label>Name</label>

        <input
          className="dashboard-input"
          value="Ashmitha"
          readOnly
        />


        <label>Email</label>

        <input
          className="dashboard-input"
          value="ashmi@example.com"
          readOnly
        />


        <button className="primary-button">
          Save Changes
        </button>

      </div>

    </DashboardLayout>
  );
}

export default Settings;