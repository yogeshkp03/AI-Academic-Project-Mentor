import DashboardLayout from "../components/DashboardLayout";

function AIMentor() {

  return (
    <DashboardLayout>

      <h1>AI Academic Mentor 💬</h1>

      <p className="page-subtitle">
        Get AI-powered guidance for your academic project.
      </p>


      <div className="chat-box">

        <div className="ai-message">
          🤖 Hello Ashmitha! How can I help you
          with your project today?
        </div>


        <div className="user-message">
          How should I start my project?
        </div>


        <div className="ai-message">
          🤖 Start by defining your problem statement,
          objectives, and project requirements.
        </div>


        <div className="chat-input">

          <input
            placeholder="Ask your AI mentor..."
          />

          <button>
            Send
          </button>

        </div>

      </div>

    </DashboardLayout>
  );
}

export default AIMentor;