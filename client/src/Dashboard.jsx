import { useEffect, useMemo, useState } from "react";
import { summarize } from "@shared/stats.js";

const CODE_KEY = "sipcheck-organiser";

function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return String(value);
}

function formatPct(value, total) {
  if (!total) return "—";
  return `${value}%`;
}

async function fetchResponses(code) {
  const response = await fetch("/api/responses", {
    headers: { Authorization: `Bearer ${code}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Could not open responses.");
    error.status = response.status;
    throw error;
  }
  return data.responses || [];
}

function Bars({ chart }) {
  const max = Math.max(1, ...chart.rows.map((row) => row.count));
  return (
    <div className="bars">
      {chart.rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <div className="bar-meta">
            <span>{row.label}</span>
            <span>
              {row.count}
              <em> · {row.pct}%</em>
            </span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
      {chart.multi && <p className="fine">People could pick more than one, so the percentages can pass 100.</p>}
      {chart.footnotes?.length > 0 && (
        <ul className="notes">
          {chart.footnotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Dashboard() {
  const [code, setCode] = useState(() => sessionStorage.getItem(CODE_KEY) || "");
  const [draft, setDraft] = useState("");
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(code));
  const [segment, setSegment] = useState("all");
  const [cityQuery, setCityQuery] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    document.title = "Responses · sip check";
  }, []);

  useEffect(() => {
    if (!code) return undefined;
    let cancelled = false;
    async function load() {
      try {
        const next = await fetchResponses(code);
        if (!cancelled) {
          setRecords(next);
          setError("");
          setLoading(false);
        }
      } catch (caught) {
        if (cancelled) return;
        setLoading(false);
        if (caught.status === 401) {
          sessionStorage.removeItem(CODE_KEY);
          setCode("");
          setRecords(null);
        }
        setError(caught.message);
      }
    }
    void load();
    const timer = setInterval(load, 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [code]);

  const summary = useMemo(
    () => (records ? summarize(records, { segment, cityQuery }) : null),
    [records, segment, cityQuery],
  );

  async function unlock(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const next = await fetchResponses(draft.trim());
      sessionStorage.setItem(CODE_KEY, draft.trim());
      setCode(draft.trim());
      setRecords(next);
    } catch (caught) {
      setError(caught.message);
      setLoading(false);
    }
  }

  async function download() {
    setExporting(true);
    try {
      const response = await fetch("/api/export", { headers: { Authorization: `Bearer ${code}` } });
      if (!response.ok) throw new Error("The Excel file could not be downloaded.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Beverage-Survey-Responses.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setExporting(false);
    }
  }

  function logout() {
    sessionStorage.removeItem(CODE_KEY);
    setCode("");
    setRecords(null);
    setDraft("");
  }

  if (!code) {
    return (
      <div className="app dash">
        <main className="card gate">
          <p className="eyebrow">Organiser</p>
          <h1>Responses stay behind a code.</h1>
          <p className="lede">
            Names and phone numbers are not on the public survey. The code is saved in{" "}
            <code>data/organizer-code.txt</code> on the computer running this survey, and it is printed when the
            server starts.
          </p>
          <form onSubmit={unlock}>
            <label className="field">
              <span>Organiser code</span>
              <input
                className="text-input"
                type="password"
                autoComplete="current-password"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn-primary" type="submit" disabled={loading || !draft.trim()}>
              {loading ? "Checking…" : "Open responses"}
            </button>
          </form>
        </main>
      </div>
    );
  }

  if (records == null) {
    return (
      <div className="app dash">
        <main className="card gate">
          <p className="eyebrow">Organiser</p>
          <h1>{error ? "Could not open responses." : "Opening responses…"}</h1>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {error && (
            <button className="btn btn-primary" type="button" onClick={() => setCode("")}>
              Try another code
            </button>
          )}
        </main>
      </div>
    );
  }

  const g = summary.global;

  return (
    <div className="app dash">
      <header className="dash-top">
        <div>
          <p className="brand">
            Shree Aabhaan
            <span>survey responses</span>
          </p>
          <h1>What people said about the saffron drink.</h1>
        </div>
        <div className="dash-actions">
          <button className="btn btn-primary" type="button" onClick={download} disabled={exporting}>
            {exporting ? "Preparing Excel…" : "Download Excel"}
          </button>
          <button className="btn btn-ghost" type="button" onClick={logout}>
            Lock
          </button>
        </div>
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <section className="kpi-grid" aria-label="Overview">
        <article>
          <span>Completed</span>
          <strong>{g.completed}</strong>
        </article>
        <article>
          <span>Screened out, under 18</span>
          <strong>{g.screened}</strong>
        </article>
        <article>
          <span>Concept appeal, 4 or 5</span>
          <strong>{formatPct(g.appealTop2Pct, g.completed)}</strong>
          <em>
            {g.appealTop2} of {g.completed}
          </em>
        </article>
        <article>
          <span>Fair price of ₹60 or more</span>
          <strong>{formatPct(g.fairAtLeast60Pct, g.completed)}</strong>
          <em>
            {g.fairAtLeast60} of {g.completed}
          </em>
        </article>
        <article>
          <span>Reachable contacts</span>
          <strong>{g.reachable}</strong>
          <em>{g.contactYes} agreed to be contacted</em>
        </article>
      </section>

      <section className="panel">
        <p className="eyebrow">Buyers and non-buyers, kept apart</p>
        <h2>Same concept, two groups.</h2>
        <div className="split">
          <article>
            <h3>Buys packaged cold drinks</h3>
            <p>
              <strong>{summary.split.buyers.n}</strong> people
            </p>
            <p>{formatPct(summary.split.buyers.appealTop2Pct, summary.split.buyers.n)} rate the concept 4 or 5</p>
            <p>{formatPct(summary.split.buyers.fairAtLeast60Pct, summary.split.buyers.n)} name a fair price of ₹60 or more</p>
          </article>
          <article>
            <h3>Does not buy them</h3>
            <p>
              <strong>{summary.split.nonBuyers.n}</strong> people
            </p>
            <p>{formatPct(summary.split.nonBuyers.appealTop2Pct, summary.split.nonBuyers.n)} rate the concept 4 or 5</p>
            <p>{formatPct(summary.split.nonBuyers.fairAtLeast60Pct, summary.split.nonBuyers.n)} name a fair price of ₹60 or more</p>
          </article>
        </div>
      </section>

      <div className="filters">
        <div className="segment" role="group" aria-label="Who to include">
          {[
            ["all", "Everyone"],
            ["buyers", "Buyers"],
            ["nonbuyers", "Non-buyers"],
          ].map(([id, label]) => (
            <button key={id} type="button" className={segment === id ? "chip on" : "chip"} onClick={() => setSegment(id)}>
              {label}
            </button>
          ))}
        </div>
        <label className="city-filter">
          <span className="sr-only">Filter by city or area</span>
          <input
            className="text-input"
            placeholder="Filter by city or area"
            value={cityQuery}
            onChange={(event) => setCityQuery(event.target.value)}
          />
        </label>
        <p className="fine">
          Charts below use this view. n = {summary.slice.n}. The overview numbers above stay on everyone who finished.
        </p>
      </div>

      {g.completed === 0 && (
        <section className="panel">
          <h2>No completed responses yet.</h2>
          <p>Share the survey link. Answers land here, and in the Excel file, as soon as someone sends them.</p>
        </section>
      )}

      {g.completed > 0 && summary.slice.n === 0 && (
        <section className="panel">
          <h2>Nothing in this view.</h2>
          <p>Clear the city filter to see the other responses.</p>
        </section>
      )}

      {summary.slice.n > 0 &&
        summary.blocks.map((block) => (
          <section className="panel" id={block.id} key={block.id}>
            <p className="eyebrow">{block.kicker}</p>
            <h2>{block.title}</h2>
            <p className="purpose">{block.purpose}</p>
            {block.warning && <p className="warning">{block.warning}</p>}
            {block.charts.length === 0 && (
              <p>People in this view were not asked where they buy drinks today.</p>
            )}
            <div className={block.charts.length > 1 ? "chart-grid" : ""}>
              {block.charts.map((chart) => (
                <article className="chart" key={chart.title}>
                  <h3>{chart.title}</h3>
                  {chart.hint && <p className="fine">{chart.hint}</p>}
                  <p className="fine">n = {chart.n}</p>
                  <Bars chart={chart} />
                </article>
              ))}
            </div>
          </section>
        ))}

      <section className="panel" id="tasting">
        <p className="eyebrow">Who to invite for tasting</p>
        <h2>People who said yes to contact.</h2>
        <p className="purpose">Use only the permission they selected. Interest is not an order.</p>
        {summary.contacts.length === 0 ? (
          <p>No one in this view agreed to be contacted.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone or email</th>
                  <th>Permission</th>
                  <th>City</th>
                  <th>Appeal</th>
                </tr>
              </thead>
              <tbody>
                {summary.contacts.map((person) => (
                  <tr key={person.id}>
                    <td>{person.name || "—"}</td>
                    <td>{person.contact || "—"}</td>
                    <td>{person.permission}</td>
                    <td>{person.city || "—"}</td>
                    <td>{person.appeal || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
