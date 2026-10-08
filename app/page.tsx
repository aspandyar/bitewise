import { ru } from "@/lib/i18n/ru";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{ru.app.name}</h1>
      <p className="text-lg text-foreground/80">{ru.home.tagline}</p>
      <p className="text-sm text-foreground/60">{ru.home.comingSoon}</p>
    </main>
  );
}
