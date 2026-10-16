# AI Academic Project Mentor

AI-Guided Academic Project Progress Tracking Platform with Planning & Mentorship Assistance

## Tech Stack

- Python
- FastAPI
- Celery and Redis
- ReactJS
- SQLAlchemy (SQLite locally; PostgreSQL can be configured for shared workers)
- CrewAI

## Backend and agents services

Analysis requests are saved as runs in the backend database and processed by a
Celery worker through Redis. The backend database remains the source of truth
for reports, chat sessions, and messages. The agents service reports progress
and each specialist's output for the eight analysis steps back to the backend.
The seven core specialists finish before the isolated Learning Resources stage.
Resource lookups have a shorter timeout and no provider retries; if they fail,
the complete analysis is still returned with a note that links could not be
verified.
Saved step outputs remain available when agent work finishes but validation or
assembly of the combined report fails; the run is still marked failed in that
case so the status describes the complete analysis, not just individual tasks.

Configure `backend/.env` from `backend/.env.example` and `agents/.env` from
`agents/.env.example`. Set `AI_SERVICE_API_KEY` and `AGENTS_API_TOKEN` to the
same strong secret. Set `AGENTS_PROGRESS_TOKEN` and `BACKEND_PROGRESS_TOKEN`
to a separate shared secret. In production set `APP_ENV=production` for the
backend and agents service, and do not expose the agents port publicly.
The API process and every Celery worker must use the same `DATABASE_URL`.
SQLite is suitable for local single-host use; use PostgreSQL when the API and
workers run on separate hosts or containers.

Install backend runtime dependencies with `pip install -r
backend/requirements.txt`. For development and tests, install
`pip install -r backend/requirements-dev.txt` instead.

Run a Redis server and start the services from their respective directories.
Start the backend API, a Celery worker, and exactly one Celery Beat scheduler
as separate processes. For local development on Windows, the Celery worker
can use its single-process pool:

```powershell
# backend/
uvicorn app.main:app --host 127.0.0.1 --port 8002
python -m celery -A app.celery_app:celery_app worker --loglevel=INFO --pool=solo
python -m celery -A app.celery_app:celery_app beat --loglevel=INFO

# agents/
uvicorn main:app --host 127.0.0.1 --port 8001
```

In production, use the deployment's normal multi-process Celery worker pool,
keep the agents service and Redis on private networks, and run only one Beat
scheduler. Analysis run records and per-agent step statuses are exposed through
the existing authenticated project agent-runs endpoint. The agents service's
one-hour request deadline, backend read timeout, Celery task limits, and Redis
visibility timeout are configurable in the example environment files; keep
their ordering intact when changing them.
In a container deployment, bind the agents API to its container interface and
restrict inbound access with the private network/firewall rather than exposing
it to the public internet.

## Frontend

Configure `frontend/.env` from `frontend/.env.example`. Set
`VITE_API_BASE_URL` to the browser-reachable backend URL **before building**;
Vite embeds it in the static bundle. Set backend `CORS_ORIGINS` to the exact
frontend origin. From `frontend/`, run `npm ci` and `npm run dev` locally, or
use `npm run lint` and `npm run build` for production validation.

The frontend resumes polling stored analysis runs while they are active, shows
the eight persisted agent stages, and displays saved project milestones. The AI
Workspace lets students select each saved specialist report directly and start
an AI Mentor chat without asking for a report in the chat box. Mentor chats
receive the latest saved specialist outputs as reference context; existing
specialist conversations keep their original agent assignment. Student skills
and chat sessions are stored by the backend; skill context is forwarded to the
agents service for analysis and chat. The Tasks page represents checkable
milestones, not a separate generic task manager.

Students can permanently delete a submitted project from the Projects page.
Deletion requires confirmation and removes its analyses, specialist outputs,
milestones, conversations, and messages. A project with a queued or running
analysis cannot be deleted until that run finishes.

## Faculty reviews and skill assessments

Faculty can request access at `/faculty/register`. New accounts cannot view
student data until an administrator approves them. From `backend/`, an
administrator can review pending accounts and approve a verified faculty
email using the application database:

```powershell
.\venv\Scripts\python.exe manage_faculty.py --list-pending
.\venv\Scripts\python.exe manage_faculty.py --approve faculty@example.edu
```

Faculty then sign in at `/faculty/login` to review submitted project proposals,
AI reports, and milestone progress. A faculty evaluation is stored against its
project and is visible to the student in the Tasks page. Faculty sessions use
a separate browser token and do not replace student sign-in.

Students can manage technical skills in Profile and take a non-proctored quiz
at **Skill Assessment**. Questions are selected from the saved skills, scored
by the backend, and stored as assessment attempts for that student.

### Faculty mentorship requests

Approved faculty can enable availability, list expertise, and respond to student
appeals from the Faculty dashboard. Students use **Find a mentor** to view
available faculty and submit a request. Their profile name, account email,
department, semester, saved skills, and latest completed skill-assessment score
are shown to the selected faculty after the student consents. The app does not
currently store resumes, so it does not collect or share one.

Approval alone does not make a faculty member discoverable: they must also
enable mentorship availability and save their expertise. The faculty dashboard
shows whether they are accepting new requests. Students can search available
faculty by name, department, or expertise and filter by department.

Faculty have seven days from receipt to respond. The deadline is enforced by the
backend and Celery Beat expires unanswered requests; student and faculty
dashboards also display a live countdown. If a student sends multiple requests,
the first acceptance becomes the sole active mentor and closes the other
pending requests. Rejection requires a reason.

Faculty project review access is limited to projects owned by students whose
mentorship request they accepted. Pending, rejected, expired, or closed requests
do not grant project access. Faculty evaluations are likewise accepted-mentee
only, and one faculty member cannot view another faculty member's evaluation in
the faculty dashboard.

The in-app request form works without external setup. To use a Google Form,
create required questions with these exact titles: **Student email**, **Faculty
ID**, **Course or area**, **Project idea**, **Appeal message**, and **I consent
to share my profile data**. Configure Google Forms to collect **verified**
respondent email addresses, and make the consent question required. The student
dashboard pre-fills the account email and selected faculty ID when entry IDs are
configured; the form still collects project and appeal details.

Set `VITE_FACULTY_APPEAL_FORM_URL` to the form's `viewform` URL in
`frontend/.env`. To prefill the two values, create a pre-filled link in Google
Forms and copy the entry IDs into `VITE_FORM_ENTRY_STUDENT_EMAIL` and
`VITE_FORM_ENTRY_FACULTY_ID`. Rebuild/restart the frontend after setting these
Vite variables.

For Google Forms responses to create requests in the dashboards, set a long
random `GOOGLE_FORMS_WEBHOOK_SECRET` in `backend/.env` and deploy the following
Form-bound Apps Script with an installable **On form submit** trigger. Also set
the script properties `MENTOR_APPEAL_WEBHOOK_URL` to the backend URL ending in
`/integrations/google-forms/mentor-appeals` and `MENTOR_APPEAL_WEBHOOK_SECRET`
to the same secret. Keep the backend endpoint HTTPS-accessible to Google Apps
Script. The backend matches the submitted email to an existing student account
and ignores unregistered addresses.

```javascript
function onFormSubmit(e) {
  const fields = {};
  e.response.getItemResponses().forEach((itemResponse) => {
    fields[itemResponse.getItem().getTitle()] = String(itemResponse.getResponse());
  });
  const verifiedEmail = e.response.getRespondentEmail();
  const submittedEmail = String(fields['Student email'] || '').trim();
  if (!verifiedEmail || verifiedEmail.toLowerCase() !== submittedEmail.toLowerCase()) {
    throw new Error('Use the verified Google account email matching your student account.');
  }

  const properties = PropertiesService.getScriptProperties();
  const response = UrlFetchApp.fetch(
    properties.getProperty('MENTOR_APPEAL_WEBHOOK_URL'),
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'X-Google-Forms-Secret': properties.getProperty('MENTOR_APPEAL_WEBHOOK_SECRET'),
      },
      payload: JSON.stringify({
        submission_id: e.response.getId(),
        student_email: verifiedEmail,
        faculty_id: Number(fields['Faculty ID']),
        course_area: fields['Course or area'],
        project_idea: fields['Project idea'],
        message: fields['Appeal message'],
        share_profile: /\b(yes|consent|agree)\b/i.test(
          fields['I consent to share my profile data'] || '',
        ),
      }),
      muteHttpExceptions: true,
    },
  );

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error(`Mentor appeal was not accepted: ${response.getContentText()}`);
  }
}
```

Run Celery Beat alongside the backend/worker for automatic expiry; requests are
also expired when either dashboard loads or when faculty try to respond.

The **Tasks** page also includes an on-demand Risk Agent. It assesses project
delivery risks, saves likelihood, impact, and mitigation guidance in the
project's risk register, and lets students mark each risk open, mitigated, or
accepted. Reassessing refreshes matching entries and reopens risks identified
again by the agent.

Students can submit weekly check-ins from the **Tasks** page with completed
work, current work, blockers, next week's goal, and a confidence rating. The
AI Mentor reviews each update against the saved project plan and milestones;
both the update and feedback are saved in project check-in history. Check-ins
do not change milestones automatically. Students can request a revised plan
from a saved check-in, review the proposal, and approve or reject it. Approval
preserves completed milestones, replaces only unfinished steps, and refuses to
apply a proposal if the saved milestones changed after the proposal was drafted.

## Team

- Member 1 - Backend/API
- Member 2 - AI/CrewAI
- Member 3 - React Frontend
- Member 4 - Database/Data
- Member 5 - Faculty Dashboard/QA