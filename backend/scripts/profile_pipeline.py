"""Profile each step of the AI pipeline to find bottlenecks."""
import sys, time
sys.path.insert(0, '.')

TEXT_TITLE = "WiFi not working in room A412"
TEXT_DESC  = "My wifi has been down for 2 days. Cannot connect, error shows No internet secured."

print("=== PIPELINE PROFILER ===\n")

# 1. Embedding cold
t = time.time()
from app.services.embeddings import generate_embedding
emb = generate_embedding(f"{TEXT_TITLE}. {TEXT_DESC}")
t1_cold = (time.time() - t) * 1000
print(f"1. Embedding (cold):      {t1_cold:.0f}ms")

# 1b. Embedding cached
t = time.time()
emb = generate_embedding(f"{TEXT_TITLE}. {TEXT_DESC}")
t1_cache = (time.time() - t) * 1000
print(f"1. Embedding (cached):    {t1_cache:.1f}ms")

# 2. FAISS search
t = time.time()
from app.services.rag import search_similar
matches = search_similar(emb, top_k=3)
t2 = (time.time() - t) * 1000
print(f"2. FAISS search:          {t2:.1f}ms  ({len(matches)} matches)")

# 3. DistilBERT classify
t = time.time()
from app.services.classifier import classify_ticket
r = classify_ticket(TEXT_TITLE, TEXT_DESC)
t3 = (time.time() - t) * 1000
print(f"3. DistilBERT classify:   {t3:.0f}ms  label={r['label']} score={r['score']:.2f}")

# 4. Zero-shot financial
t = time.time()
from app.services.classifier import classify_financial_category
r2 = classify_financial_category(TEXT_TITLE, TEXT_DESC)
t4 = (time.time() - t) * 1000
print(f"4. Zero-shot financial:   {t4:.0f}ms  cat={r2['category']}")

# 5. Risk + confidence + decision
t = time.time()
from app.services.risk import evaluate_risk
from app.services.confidence import compute_confidence
from app.services.decision import make_decision
risk, adj = evaluate_risk('P2', 'STANDARD')
conf = compute_confidence(0.75, 0.5, 0.8, adj)
action, reason = make_decision(conf, risk)
t5 = (time.time() - t) * 1000
print(f"5. Risk+Conf+Decision:    {t5:.1f}ms  action={action} conf={conf:.2f}")

# Full pipeline
t = time.time()
from app.services.ai_pipeline import run_pipeline
result = run_pipeline(99999, TEXT_TITLE, TEXT_DESC, 'P2', 'STANDARD')
t_full = (time.time() - t) * 1000
print(f"\nFULL PIPELINE:            {t_full:.0f}ms  action={result.action} conf={result.confidence:.2f}")
print(f"\nBottleneck breakdown:")
print(f"  Embedding:   {t1_cold:.0f}ms")
print(f"  FAISS:       {t2:.1f}ms")
print(f"  DistilBERT:  {t3:.0f}ms")
print(f"  Zero-shot:   {t4:.0f}ms  <-- likely slowest")
print(f"  Logic:       {t5:.1f}ms")
