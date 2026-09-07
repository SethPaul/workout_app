interface NavEntry {
  href: string;
  label: string;
  icon: string;
}

const ENTRIES: NavEntry[] = [
  { href: '/', label: 'Today', icon: '☀' },
  { href: '/pool', label: 'Pool', icon: '\u{1F4CB}' },
  { href: '/movements', label: 'Moves', icon: '\u{1F3CB}' },
  { href: '/history', label: 'History', icon: '\u{1F4C8}' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

function isActive(entryHref: string, path: string): boolean {
  if (entryHref === '/') return path === '/';
  return path === entryHref || path.startsWith(`${entryHref}/`);
}

export function BottomNav({ path }: { path: string }) {
  return (
    <nav class="nav-bar" aria-label="Primary">
      {ENTRIES.map((entry) => (
        <a
          key={entry.href}
          href={entry.href}
          class={`nav-item${isActive(entry.href, path) ? ' active' : ''}`}
        >
          <span class="nav-icon" aria-hidden="true">
            {entry.icon}
          </span>
          <span>{entry.label}</span>
        </a>
      ))}
    </nav>
  );
}
