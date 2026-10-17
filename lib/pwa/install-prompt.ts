// Chrome fires beforeinstallprompt once, often before the profile screen exists; the root layout
// catches it here and the install row reads it when it mounts.
type InstallPromptEvent = Event & { prompt(): Promise<void> };

let deferred: InstallPromptEvent | null = null;
const subscribers = new Set<() => void>();

function notify() {
  for (const subscriber of subscribers) subscriber();
}

export function listenForInstallPrompt(target: Window): () => void {
  const onPrompt = (event: Event) => {
    // Keeps the browser's own mini-bar away; the profile offers the dialog instead.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  };
  const onInstalled = () => {
    deferred = null;
    notify();
  };
  target.addEventListener("beforeinstallprompt", onPrompt);
  target.addEventListener("appinstalled", onInstalled);
  return () => {
    target.removeEventListener("beforeinstallprompt", onPrompt);
    target.removeEventListener("appinstalled", onInstalled);
  };
}

export function subscribeInstallPrompt(subscriber: () => void): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function getInstallPrompt(): InstallPromptEvent | null {
  return deferred;
}

// The event can be used once; after the dialog the row hides until the browser offers it again.
export async function promptInstall(): Promise<void> {
  const event = deferred;
  if (!event) return;
  deferred = null;
  notify();
  await event.prompt();
}
