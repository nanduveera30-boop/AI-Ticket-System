"""Quick profile — assumes models already loaded (warm run)."""
import sys, time
sys.path.insert(0, '.')

TEXT_TITLE = "WiFi not working in room A412"
TEXT_DESC  = "My wifi has been down for 2 days. Cannot connect, error shows No internet secured."

print("=== WARM PIPELINE PROFILER ===\n")

# Pre-load models
from app.services.embeddings import get_model
from app.services.rag import load_index
from app.services.classifier import _keyword_classify, _keyword_financial

get_model()
load_index()

# Warm up caches
from app.services.embeddings import generate_embedding
generate_embedding(f"{TEXT_TITLE}. {TEXT_DESC}")

print("Models loaded. Running warm benchmarks...\n")

# 1. Embedding cached
t = time.time()
emb = generate_embedding(f"{TEXT_TITLE}. {TEXT_DESC}")
print(f"1. Embedding (cached):    {(time.time()-t)*1000:.1f}ms")

# 2. FAISS
t = time.time()
from app.services.rag import search_similar
matches = search_similar(emb, top_k=3)
print(f"2. FAISS search:          {(time.time()-t)*1000:.1f}ms  ({len(matches)} matches)")

# 3. Keyword classify (new fast path)
t = time.time()
from app.services.classifier import classify_ticket
r = classify_ticket(TEXT_TITLE, TEXT_DESC)
print(f"3. Ticket classify:       {(time.time()-t)*1000:.1f}ms  label={r['label']} source={r['source']}")

# 4. Financial keyword (new instant path)
t = time.time()
from app.services.classifier import classify_financial_category
r2 = classify_financial_category(TEXT_TITLE, TEXT_DESC)
print(f"4. Financial category:    {(time.time()-t)*1000:.1f}ms  cat={r2['category']}")

# 5. Full pipeline (parallel)
t = time.time()
from app.services.ai_pipeline import run_pipeline
result = run_pipeline(88888, TEXT_TITLE, TEXT_DESC, 'P2', 'STANDARD')
t_full = (time.time()-t)*1000
print(f"\nFULL PIPELINE (warm):     {t_full:.0f}ms  action={result.action} conf={result.confidence:.2f}")
print(f"Category: {result.explanation.ticket_category}")
print(f"Financial: {result.explanation.financial_category}")

# Second run (everything cached)
t = time.time()
result2 = run_pipeline(88889, TEXT_TITLE + " urgent", TEXT_DESC, 'P1', 'VIP')
print(f"FULL PIPELINE (2nd run):  {(time.time()-t)*1000:.0f}ms  action={result2.action}")
