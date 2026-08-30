import Link from "next/link";
import { IconRoute, IconCheckCircle } from "@/app/landing/components/Icons";

export default function AuthShell({ title, subtitle, children, aside }) {
  return (
    <div className="lp">
      <div className="lp-auth">
        <div className="lp-auth__form-col">
          <Link href="/" className="lp-brand">
            <span className="lp-brand__mark" aria-hidden="true"><IconRoute /></span>
            9Router
          </Link>

          <div className="lp-auth__form-wrap">
            <h1 className="lp-auth__title">{title}</h1>
            <p className="lp-auth__sub">{subtitle}</p>
            {children}
          </div>
        </div>

        <aside className="lp-auth__aside">
          <h2>{aside.title}</h2>
          <p>{aside.body}</p>
          <ul className="lp-auth__points">
            {aside.points.map((p) => (
              <li key={p}><IconCheckCircle /> {p}</li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
