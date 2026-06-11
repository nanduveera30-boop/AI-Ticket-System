"""
Train YOUR ticket classifier using DistilBERT.
=============================================
- Uses data/training_data.csv (your labeled dataset)
- Fine-tunes distilbert-base-uncased on CPU (no GPU needed)
- Saves model to models/ticket_classifier/
- Training takes ~5-15 minutes on a low-grade laptop

Usage:
    cd backend
    python scripts/train_classifier.py

After training, the system will load YOUR model automatically.
"""

import os
import sys
import json
import time
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, accuracy_score

# Add backend root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

DATA_PATH  = Path(__file__).parent.parent / "data" / "training_data.csv"
MODEL_DIR  = Path(__file__).parent.parent / "models" / "ticket_classifier"
LABEL_MAP  = Path(__file__).parent.parent / "models" / "label_map.json"

# Training config — tuned for low-grade CPU laptops
CONFIG = {
    "base_model":    "distilbert-base-uncased",
    "max_length":    128,       # shorter = faster on CPU
    "batch_size":    8,
    "epochs":        3,         # 3 epochs is enough for fine-tuning
    "learning_rate": 2e-5,
    "weight_decay":  0.01,
    "test_size":     0.2,
    "seed":          42,
}


def load_data():
    print("\n[1/5] Loading training data...")
    df = pd.read_csv(DATA_PATH)
    df = df.dropna().reset_index(drop=True)
    df["text"] = df["text"].str.strip()
    df["label"] = df["label"].str.strip()

    print(f"      Total samples: {len(df)}")
    print(f"      Label distribution:")
    for label, count in df["label"].value_counts().items():
        print(f"        {label}: {count}")
    return df


def encode_labels(df):
    le = LabelEncoder()
    df["label_id"] = le.fit_transform(df["label"])
    label_map = {int(i): str(l) for i, l in enumerate(le.classes_)}
    id2label  = label_map
    label2id  = {v: k for k, v in label_map.items()}
    print(f"\n[2/5] Labels encoded: {label_map}")
    return df, id2label, label2id


def train():
    try:
        from transformers import (
            DistilBertTokenizerFast,
            DistilBertForSequenceClassification,
            TrainingArguments,
            Trainer,
        )
        import torch
        from torch.utils.data import Dataset
    except ImportError:
        print("\nERROR: transformers and torch not installed.")
        print("Run: pip install transformers torch")
        sys.exit(1)

    df = load_data()
    df, id2label, label2id = encode_labels(df)

    # Train/test split
    train_df, test_df = train_test_split(
        df, test_size=CONFIG["test_size"],
        stratify=df["label_id"], random_state=CONFIG["seed"]
    )
    print(f"\n      Train: {len(train_df)} | Test: {len(test_df)}")

    # Tokenizer
    print(f"\n[3/5] Loading base model: {CONFIG['base_model']}")
    tokenizer = DistilBertTokenizerFast.from_pretrained(CONFIG["base_model"])

    class TicketDataset(Dataset):
        def __init__(self, texts, labels):
            self.encodings = tokenizer(
                list(texts), truncation=True,
                padding=True, max_length=CONFIG["max_length"]
            )
            self.labels = list(labels)

        def __len__(self):
            return len(self.labels)

        def __getitem__(self, idx):
            item = {k: torch.tensor(v[idx]) for k, v in self.encodings.items()}
            item["labels"] = torch.tensor(self.labels[idx])
            return item

    train_dataset = TicketDataset(train_df["text"], train_df["label_id"])
    test_dataset  = TicketDataset(test_df["text"],  test_df["label_id"])

    # Model
    num_labels = len(id2label)
    model = DistilBertForSequenceClassification.from_pretrained(
        CONFIG["base_model"],
        num_labels=num_labels,
        id2label=id2label,
        label2id=label2id,
    )

    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        preds = np.argmax(logits, axis=-1)
        return {"accuracy": float(accuracy_score(labels, preds))}

    # Training arguments — CPU optimized
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    args = TrainingArguments(
        output_dir=str(MODEL_DIR),
        num_train_epochs=CONFIG["epochs"],
        per_device_train_batch_size=CONFIG["batch_size"],
        per_device_eval_batch_size=CONFIG["batch_size"],
        learning_rate=CONFIG["learning_rate"],
        weight_decay=CONFIG["weight_decay"],
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="accuracy",
        logging_steps=10,
        no_cuda=True,           # force CPU
        dataloader_num_workers=0,
        report_to="none",       # no wandb/tensorboard
        seed=CONFIG["seed"],
    )

    print(f"\n[4/5] Training on CPU — this will take a few minutes...")
    print(f"      Epochs: {CONFIG['epochs']} | Batch: {CONFIG['batch_size']} | LR: {CONFIG['learning_rate']}")
    start = time.time()

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=train_dataset,
        eval_dataset=test_dataset,
        compute_metrics=compute_metrics,
    )
    trainer.train()

    elapsed = time.time() - start
    print(f"\n      Training complete in {elapsed:.0f}s ({elapsed/60:.1f} min)")

    # Evaluate
    print("\n[5/5] Evaluating on test set...")
    preds_output = trainer.predict(test_dataset)
    preds = np.argmax(preds_output.predictions, axis=-1)
    true  = test_df["label_id"].values

    print("\n" + "="*60)
    print("CLASSIFICATION REPORT")
    print("="*60)
    print(classification_report(true, preds, target_names=list(id2label.values())))
    acc = accuracy_score(true, preds)
    print(f"Overall Accuracy: {acc:.4f} ({acc*100:.2f}%)")
    print("="*60)

    # Save model + tokenizer
    trainer.save_model(str(MODEL_DIR))
    tokenizer.save_pretrained(str(MODEL_DIR))

    # Save label map
    LABEL_MAP.parent.mkdir(parents=True, exist_ok=True)
    with open(LABEL_MAP, "w") as f:
        json.dump({"id2label": id2label, "label2id": label2id}, f, indent=2)

    # Save training metadata
    meta = {
        "base_model":    CONFIG["base_model"],
        "trained_by":    "custom training script",
        "dataset":       "data/training_data.csv",
        "num_samples":   len(df),
        "num_labels":    num_labels,
        "labels":        list(id2label.values()),
        "accuracy":      round(acc, 4),
        "epochs":        CONFIG["epochs"],
        "model_path":    str(MODEL_DIR),
    }
    with open(MODEL_DIR / "training_meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\nModel saved to: {MODEL_DIR}")
    print(f"Label map saved to: {LABEL_MAP}")
    print("\nYou can now start the API — it will load YOUR trained model.")


if __name__ == "__main__":
    train()
