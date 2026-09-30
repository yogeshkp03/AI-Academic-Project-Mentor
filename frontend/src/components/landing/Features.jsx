const FEATURES = [
  {
    icon: '🤖',
    title: 'AI Planning',
    description: 'Generate a smart project plan, architecture blueprint, and timeline.',
  },
  {
    icon: '📊',
    title: 'Progress Tracking',
    description: 'Track analysis runs, tasks, and milestones across all your projects.',
  },
  {
    icon: '💬',
    title: 'AI Mentor',
    description: 'Chat with specialist agents on scope, resources, UI/UX, and QA.',
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-5xl px-6 pb-20">
      <h2 className="text-center text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
        Everything you need to ship your project
      </h2>
      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <article
            key={feature.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
          >
            <div className="flex size-12 items-center justify-center rounded-xl bg-slate-50 text-2xl">
              {feature.icon}
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">{feature.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}