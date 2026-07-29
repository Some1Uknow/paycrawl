import Link from "next/link";

type NavLink = {
  href: string;
  label: string;
};

type SiteNavProps = {
  links: NavLink[];
  action: NavLink;
};

export function Mark(): React.ReactElement {
  return (
    <svg aria-hidden="true" className="mark" viewBox="0 0 48 48" fill="none">
      <path
        d="M7 12.5h24.5L41 22l-9.5 9.5H7V12.5Z"
        stroke="currentColor"
        strokeWidth="2.6"
      />
      <path
        d="M7 20h26M15 12.5v19M25 12.5v19"
        stroke="currentColor"
        strokeWidth="2.6"
      />
      <circle cx="37" cy="31.5" r="5" fill="currentColor" />
    </svg>
  );
}

export function SiteNav({ links, action }: SiteNavProps): React.ReactElement {
  return (
    <nav className="nav" aria-label="Primary navigation">
      <Link className="brand" href="/">
        <Mark />
        <span>PayCrawl</span>
      </Link>
      <div className="nav-links">
        {links.map((link) => (
          <a key={link.href} href={link.href}>
            {link.label}
          </a>
        ))}
      </div>
      <a className="nav-cta" href={action.href}>
        {action.label} <span aria-hidden="true">↗</span>
      </a>
    </nav>
  );
}

export function SiteFooter(): React.ReactElement {
  return (
    <footer className="site-footer">
      <Link className="brand" href="/">
        <Mark />
        <span>PayCrawl</span>
      </Link>
      <p>Paid machine-readable content for agents.</p>
      <div className="footer-links">
        <Link href="/docs">Docs</Link>
        <a
          href="https://github.com/Some1Uknow/paycrawl"
          target="_blank"
          rel="noreferrer"
        >
          GitHub <span aria-hidden="true">↗</span>
        </a>
      </div>
    </footer>
  );
}
