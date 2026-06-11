import { useState, useEffect } from "react";
import { getFAQs, searchFAQs } from "../../api/chat";

const CATEGORIES = ["All", "Account", "Support", "AI System", "Features", "Billing"];

export default function FAQPage() {
  const [faqs, setFaqs]         = useState([]);
  const [query, setQuery]       = useState("");
  const [category, setCategory] = useState("All");
  const [open, setOpen]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    const cat = category === "All" ? undefined : category;
    setLoading(true);
    setError(null);
    getFAQs(cat)
      .then(setFaqs)
      .catch(() => setError("Failed to load FAQs."))
      .finally(() => setLoading(false));
  }, [category]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const results = await searchFAQs(query.trim());
      setFaqs(results);
      if (results.length === 0) setError("No results found for your search.");
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function clearSearch() {
    setQuery("");
    const cat = category === "All" ? undefined : category;
    setLoading(true);
    getFAQs(cat).then(setFaqs).catch(() => {}).finally(() => setLoading(false));
  }

  return (
    <div className="cpage">
      <div className="page-header">
        <h1>Help Center</h1>
        <p>Find answers to common questions instantly.</p>
      </div>

      {/* Search */}
      <div className="card">
        <form className="faq-search-bar" onSubmit={handleSearch}>
          <div style={{ position: "relative", flex: 1 }}>
            <span className="material-symbols-outlined" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--outline)", fontSize: 18, pointerEvents: "none" }}>search</span>
            <input
              className="form-input faq-search-input"
              type="text"
              placeholder="Search FAQs…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ paddingLeft: 40 }}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={!query.trim()}>Search</button>
          {query && (
            <button type="button" className="btn-ghost" onClick={clearSearch}>Clear</button>
          )}
        </form>
      </div>

      {/* Categories */}
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

      {/* FAQ list */}
      <div className="card">
        {loading && (
          <div className="loading-state">
            <span className="material-symbols-outlined" style={{ fontSize: 32, display: "block", margin: "0 auto 8px", color: "var(--outline)" }}>hourglass_empty</span>
            Loading FAQs…
          </div>
        )}

        {!loading && error && (
          <div className="empty-state">
            <span className="material-symbols-outlined" style={{ fontSize: 36, display: "block", margin: "0 auto 8px", color: "var(--outline)" }}>search_off</span>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && faqs.length === 0 && (
          <div className="empty-state">
            <span className="material-symbols-outlined" style={{ fontSize: 36, display: "block", margin: "0 auto 8px", color: "var(--outline)" }}>help_outline</span>
            <p>No FAQs found.</p>
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
                <span style={{ flex: 1, textAlign: "left" }}>{faq.question}</span>
                <span className="material-symbols-outlined faq-chevron" style={{ fontSize: 18, transition: "transform 0.2s", transform: open === faq.id ? "rotate(180deg)" : "none" }}>
                  expand_more
                </span>
              </button>
              {open === faq.id && (
                <div className="faq-answer">
                  <p>{faq.answer}</p>
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

        {!loading && faqs.length > 0 && (
          <div className="faq-footer">
            <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: "middle", marginRight: 6, color: "var(--primary-container)" }}>support_agent</span>
            Can't find what you're looking for?{" "}
            <span style={{ color: "var(--primary-container)", cursor: "pointer", fontWeight: 700 }}>Submit a ticket</span>
          </div>
        )}
      </div>
    </div>
  );
}
