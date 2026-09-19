export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        AI Interview Prep Kit
      </h1>
      <p className="text-neutral-600">
        Project foundation. The interview-kit UI is not built yet.
      </p>
      <p className="text-sm text-neutral-500">
        Backend health check:{' '}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5">
          GET /api/health
        </code>
      </p>
    </main>
  );
}
