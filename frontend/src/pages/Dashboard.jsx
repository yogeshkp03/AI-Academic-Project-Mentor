import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useProjects } from '../hooks/useProjects';
import { Card, EmptyState, PageHeader, ProgressBar, Spinner, StatCard } from '../components/ui';

const NEXT_STEPS = [
  { step: '01', title: 'Submit a project idea', text: 'Use the AI Planner or Projects page' },
  { step: '02', title: 'Run an AI analysis', text: 'Get a feasibility + architecture blueprint' },
  { step: '03', title: 'Ask specialist agents', text: 'Discuss scope, timeline, and QA in the AI Workspace' },
];

function Dashboard() {
  const { studentId, studentName } = useAuth();
  const { projects, loading } = useProjects(studentId);

  const analyzed = projects.filter((project) => project.ai_report).length;

  return (
    <>
      <PageHeader
        title={`Good Morning, ${studentName}! 👋`}
        subtitle="Here's an overview of your academic projects."
        actions={
          <Link
            to="/profile"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-card transition hover:bg-slate-50"
          >
            👩‍🎓 {studentName}
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="📁" color="blue" label="Projects" value={projects.length} />
        <StatCard icon="✅" color="green" label="Analyzed" value={`${analyzed} / ${projects.length}`} />
        <StatCard icon="🤖" color="purple" label="AI Workspace" value="Ready" />
        <StatCard icon="📊" color="orange" label="Analytics" value="See below" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card
          title="My Projects"
          className="lg:col-span-2"
          actions={<Link to="/projects" className="text-sm font-semibold text-brand-600 hover:text-brand-700">View All →</Link>}
        >
          {loading ? (
            <div className="flex justify-center py-8 text-brand-600">
              <Spinner />
            </div>
          ) : projects.length === 0 ? (
            <EmptyState
              icon="📭"
              title="No projects yet"
              message="Create one to get an AI plan."
              action={<Link to="/ai-planner" className="text-sm font-bold text-brand-600 hover:text-brand-700">Generate a new AI plan →</Link>}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {projects.slice(0, 4).map((project) => (
                <div key={project.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-slate-900">{project.title}</h3>
                      <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{project.idea}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${project.ai_report ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {project.ai_report ? 'Analyzed' : 'Draft'}
                    </span>
                  </div>
                  <ProgressBar value={project.ai_report ? 100 : 10} className="mt-2" />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Next Steps">
          <div className="flex flex-col">
            {NEXT_STEPS.map((item) => (
              <div key={item.step} className="flex items-center gap-4 border-b border-slate-100 py-4 last:border-0">
                <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 font-extrabold text-brand-600">
                  {item.step}
                  <span className="text-[10px] font-bold text-slate-400">{item.title.split(' ')[0]}</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                  <p className="text-xs text-slate-500">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <section className="mt-6 flex animate-fade-up flex-col gap-4 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-violet-50 p-6 sm:flex-row sm:items-center">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-card">
          🤖
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-900">AI Recommendation</h2>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
            {analyzed > 0
              ? `You have ${analyzed} analyzed project${analyzed > 1 ? 's' : ''}. Open the AI Workspace to continue specialist conversations about scope, timeline, and resources.`
              : 'Submit a project and run an AI analysis to unlock a feasibility report, architecture blueprint, and a week-by-week plan.'}
          </p>
        </div>
        <Link to="/ai-mentor" className="shrink-0 text-sm font-bold text-brand-600 hover:text-brand-700">
          Open AI Workspace →
        </Link>
      </section>
    </>
  );
}

export default Dashboard;