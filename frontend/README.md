# Frontend

The React/Vite client uses the backend API for authentication, projects,
analysis runs, milestones, profile skills, conversations, and chat history.
Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` to the backend URL.
Vite embeds that value during the build, so set it before running `npm run build`.

Install and start the development server:

```powershell
npm ci
npm run dev
```

Run the production checks and preview the generated client:

```powershell
npm run lint
npm run build
npm run preview
```

The backend `CORS_ORIGINS` setting must include the exact browser origin, such
as `http://localhost:5173` in local development. The browser talks only to the
backend; it does not call the agents service directly.

From an AI Mentor conversation, choose **Update plan from chat** to create a
new version using that saved discussion. Previous analysis versions remain
available. Saved reports can be downloaded as Markdown (`.md`) or PDF from the
analysis history.
