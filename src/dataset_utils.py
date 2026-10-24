import csv
import json
from pathlib import Path


# query relevance judgement
def load_qrels(data_path: str, split: str):
    qrels_path = Path(data_path) / "qrels" / f"{split}.tsv"
    qrels = {}
    with qrels_path.open(encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        next(reader)  # skip header row
        for row in reader:
            query_id, doc_id, relevance = row
            if query_id not in qrels:
                qrels[query_id] = {}
            qrels[query_id][doc_id] = int(relevance)
    return qrels


def load_queries(data_path: str, qrels: dict):
    queries_path = Path(data_path) / "queries.jsonl"
    queries = {}
    for line in queries_path.open(encoding="utf-8"):
        query = json.loads(line)
        query_id = query["_id"]
        if query_id in qrels:
            queries[query_id] = query["text"]
    return queries


def load_subset_doc_ids(data_path: str, split: str):
    doc_ids = set()
    qrels = load_qrels(data_path, split)
    for doc_scores in qrels.values():
        doc_ids.update(doc_scores.keys())
    return doc_ids
