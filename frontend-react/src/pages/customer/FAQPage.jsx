import { useState, useEffect, useRef, useCallback } from "react";
import { getFAQs, searchFAQs } from "../../api/chat";

const CATEGORIES = ["All", "Account", "Support", "AI System", "Features", "Billing"];

function highlight(text, query) {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background: "var(--primary-fixed)", color: "var(--on-primary-fixed)", borderRadius: 2, padding: "0 2px" }}>{part}</mark>
      : part
  );
}

export default function FAQPage() {
  const [faqs, setFaqs]         = useState([]);
  const [query, setQuery]       = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [category, setCategory] = useState("All");
  const [open, setOpen]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const debounceRef             = useRef(null);

  // Debounce search input 350ms
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(query), 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Fetch when debounced query or category changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    const promise = debouncedQ.trim().length >= 2
      ? searchFAQs(debouncedQ.trim())
      : getFAQs(category === "All" ? undefined : category);

    promise
      .then(data => {
        setFaqs(data);
        if (data.length === 0 && debouncedQ.trim()) setError("No results found.");
      })
      .catch(() => setError("Failed to load FAQs."))
      .finally(() => setLoading(false));
  }, [debouncedQ, category]);

  function clearSearch() {
    setQuery("");
    setDebouncedQ("");
  }

  return (
    <div className="cpage">
      <div className="page-header">
        <h1>Help Center</h1>
        <p>Find answers to common questions instantly.</p>
      </div>

      {/* Search */}
      <div className="card">
        <div className="faq-search-bar">
          <div style={{ position: "relative", flex: 1 }}>
            <span className="material-symbols-outlined" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--outline)", fontSize: 18, pointerEvents: "none" }}>search</span>
            <input
              className="form-input"
              type="text"
              placeholder="Search FAQs… (type to search)"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ paddingLeft: 40, paddingRight: query ? 36 : 14 }}
              aria-label="Search FAQs"
            />
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--outline)", padding: 2 }}
                aria-label="Clear search"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Categories */}
      {!debouncedQ && (
        <div className="faq-categories">
          {CATEGORIES.map(c => (
            <button
              key={c}
              className={`faq-cat-btn${category === c ? " active" : ""}`}
              onClick={() => { setCategory(c); setQuery(""); }}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="card">
        {loading && (
          <div className="loading-state">
            <span className="material-symbols-outlined" style={{ fontSize: 28, display: "block", margin: "0 auto 8px", color: "var(--outline)" }}>hourglass_empty</span>
            {debouncedQ ? "Searching…" : "Loading FAQs…"}
          </div>
        )}

        {!loading && error && (
          <div className="empty-state">
            <span className="material-symbols-outlined" style={{ fontSize: 36, display: "block", margin: "0 auto 8px", color: "var(--outline)" }}>search_off</span>
            <p>{error}</p>
            {debouncedQ && <button className="btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={clearSearch}>Clear search</button>}
          </div>
        )}

        {!loading && !error && faqs.length === 0 && (
          <div className="empty-state">
            <span className="material-symbols-outlined" style={{ fontSize: 36, display: "block", margin: "0 auto 8px", color: "var(--outline)" }}>help_outline</span>
            <p>No FAQs found{category !== "All" ? ` in "${category}"` : ""}.</p>
          </div>
        )}

        {!loading && !error && faqs.length > 0 && (
          <>
            {debouncedQ && (
              <div style={{ fontSize: 12, color: "var(--on-surface-variant)", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>search</span>
                {faqs.length} result{faqs.length !== 1 ? "s" : ""} for "<strong>{debouncedQ}</strong>"
              </div>
            )}
            <div className="faq-list">
              {faqs.map(faq => (
                <div key={faq.id} className="faq-item card" style={{ padding: 0, marginBottom: 0 }}>
                  <button
                    className="faq-question"
                    onClick={() => setOpen(open === faq.id ? null : faq.id)}
                    aria-expanded={open === faq.id}
                  >
                    <span style={{ flex: 1, textAlign: "left" }}>
                      {highlight(faq.question, debouncedQ)}
                    </span>
                    <span className="material-symbols-outlined faq-chevron" style={{ fontSize: 18, transition: "transform 0.2s", transform: open === faq.id ? "rotate(180deg)" : "none" }}>
                      expand_more
                    </span>
                  </button>
                  {open === faq.id && (
                    <div className="faq-answer">
                      <p>{highlight(faq.answer, debouncedQ)}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                        {faq.category && <span className="faq-cat-tag">{faq.category}</span>}
                        {faq.view_count > 0 && (
                          <span style={{ fontSize: 11, color: "var(--on-surface-variant)" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: "middle" }}>visibility</span> {faq.view_count} views
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="faq-footer">
              <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: "middle", marginRight: 6, color: "var(--primary-container)" }}>support_agent</span>
              Can't find what you're looking for?{" "}
              <span style={{ color: "var(--primary-container)", fontWeight: 700 }}>Submit a ticket</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
