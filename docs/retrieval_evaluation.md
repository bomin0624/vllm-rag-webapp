# Retrieval evaluation results

Detailed results from BEIR qrels evaluations. Run the commands below from the
repository root; see [Development and evaluation](../README.md#development-and-evaluation)
for setup and options. An em dash means that the metric was not calculated
at that cutoff for that stage.

## NFCorpus evaluation: dev split, 512 dimensions

The full NFCorpus corpus was indexed into 4,135 chunks, and both runs were
evaluated on 324 dev queries. They used `mixedbread-ai/mxbai-embed-large-v1`
embeddings truncated to 512 dimensions, `BAAI/bge-reranker-v2-m3` for
reranking, and the top 200 retrieved chunks as reranking candidates. Initial
retrieval was evaluated at `k = 1, 5, 10, 30`; reranked retrieval was
evaluated at `k = 1, 3, 5, 10`.

### Vector retrieval

Run with `make evaluate RETRIEVER=vector SPLIT=dev DIM=512`.

| Metric | Initial retrieval | Reranked retrieval |
| --- | ---: | ---: |
| NDCG@1 | 0.4321 | 0.4244 |
| NDCG@3 | — | 0.3693 |
| NDCG@5 | 0.3703 | 0.3443 |
| NDCG@10 | 0.3461 | 0.3139 |
| NDCG@30 | 0.3101 | — |
| MAP@1 | 0.0411 | 0.0370 |
| MAP@3 | — | 0.0651 |
| MAP@5 | 0.0941 | 0.0801 |
| MAP@10 | 0.1173 | 0.0978 |
| MAP@30 | 0.1457 | — |
| Recall@1 | 0.0411 | 0.0370 |
| Recall@3 | — | 0.0760 |
| Recall@5 | 0.1200 | 0.1010 |
| Recall@10 | 0.1623 | 0.1375 |
| Recall@30 | 0.2395 | — |
| P@1 | 0.4599 | 0.4475 |
| P@3 | — | 0.3590 |
| P@5 | 0.3401 | 0.3136 |
| P@10 | 0.2759 | 0.2457 |
| P@30 | 0.1671 | — |

| Stage | Total | Per query |
| --- | ---: | ---: |
| Initial retrieval | 23.09 s | 71.26 ms |
| Reranking | 599.46 s | 1,850.20 ms |
| Both stages | 622.55 s | — |

### Hybrid retrieval (dense + BM25)

Run with `make evaluate RETRIEVER=hybrid SPLIT=dev DIM=512`.

| Metric | Initial retrieval | Reranked retrieval |
| --- | ---: | ---: |
| NDCG@1 | 0.2608 | 0.4182 |
| NDCG@3 | — | 0.3657 |
| NDCG@5 | 0.3202 | 0.3416 |
| NDCG@10 | 0.3108 | 0.3115 |
| NDCG@30 | 0.2868 | — |
| MAP@1 | 0.0184 | 0.0369 |
| MAP@3 | — | 0.0657 |
| MAP@5 | 0.0729 | 0.0811 |
| MAP@10 | 0.0961 | 0.0980 |
| MAP@30 | 0.1263 | — |
| Recall@1 | 0.0184 | 0.0369 |
| Recall@3 | — | 0.0765 |
| Recall@5 | 0.1061 | 0.1020 |
| Recall@10 | 0.1582 | 0.1384 |
| Recall@30 | 0.2436 | — |
| P@1 | 0.2932 | 0.4414 |
| P@3 | — | 0.3560 |
| P@5 | 0.3191 | 0.3111 |
| P@10 | 0.2673 | 0.2438 |
| P@30 | 0.1696 | — |

| Stage | Total | Per query |
| --- | ---: | ---: |
| Initial retrieval | 27.07 s | 83.56 ms |
| Reranking | 599.97 s | 1,851.77 ms |
| Both stages | 627.05 s | — |

Timings exclude the initial vector database build and model warm-up.

## NFCorpus evaluation: test split, 512 dimensions

Both runs reused the 4,135-chunk NFCorpus index and evaluated 323 test queries
with the same embedding model, reranker, and 200-candidate cutoff as the dev
runs above. Initial retrieval was evaluated at `k = 1, 5, 10, 30`; reranked
retrieval was evaluated at `k = 1, 3, 5, 10`.

### Vector retrieval

Run with `make evaluate RETRIEVER=vector SPLIT=test DIM=512`.

| Metric | Initial retrieval | Reranked retrieval |
| --- | ---: | ---: |
| NDCG@1 | 0.4489 | 0.4334 |
| NDCG@3 | — | 0.3930 |
| NDCG@5 | 0.3936 | 0.3633 |
| NDCG@10 | 0.3651 | 0.3345 |
| NDCG@30 | 0.3403 | — |
| MAP@1 | 0.0638 | 0.0592 |
| MAP@3 | — | 0.0978 |
| MAP@5 | 0.1195 | 0.1107 |
| MAP@10 | 0.1416 | 0.1262 |
| MAP@30 | 0.1652 | — |
| Recall@1 | 0.0638 | 0.0592 |
| Recall@3 | — | 0.1072 |
| Recall@5 | 0.1428 | 0.1289 |
| Recall@10 | 0.1848 | 0.1596 |
| Recall@30 | 0.2571 | — |
| P@1 | 0.4613 | 0.4396 |
| P@3 | — | 0.3664 |
| P@5 | 0.3399 | 0.3059 |
| P@10 | 0.2684 | 0.2415 |
| P@30 | 0.1689 | — |

| Stage | Total | Per query |
| --- | ---: | ---: |
| Initial retrieval | 20.48 s | 63.40 ms |
| Reranking | 604.70 s | 1,872.13 ms |
| Both stages | 625.18 s | — |

### Hybrid retrieval (dense + BM25)

Run with `make evaluate RETRIEVER=hybrid SPLIT=test DIM=512`.

| Metric | Initial retrieval | Reranked retrieval |
| --- | ---: | ---: |
| NDCG@1 | 0.3669 | 0.4381 |
| NDCG@3 | — | 0.3954 |
| NDCG@5 | 0.3564 | 0.3635 |
| NDCG@10 | 0.3412 | 0.3370 |
| NDCG@30 | 0.3266 | — |
| MAP@1 | 0.0498 | 0.0611 |
| MAP@3 | — | 0.0999 |
| MAP@5 | 0.1069 | 0.1137 |
| MAP@10 | 0.1274 | 0.1297 |
| MAP@30 | 0.1534 | — |
| Recall@1 | 0.0498 | 0.0611 |
| Recall@3 | — | 0.1090 |
| Recall@5 | 0.1376 | 0.1324 |
| Recall@10 | 0.1835 | 0.1638 |
| Recall@30 | 0.2600 | — |
| P@1 | 0.3808 | 0.4427 |
| P@3 | — | 0.3674 |
| P@5 | 0.3145 | 0.3034 |
| P@10 | 0.2604 | 0.2415 |
| P@30 | 0.1714 | — |

| Stage | Total | Per query |
| --- | ---: | ---: |
| Initial retrieval | 25.95 s | 80.34 ms |
| Reranking | 601.93 s | 1,863.56 ms |
| Both stages | 627.88 s | — |

Timings exclude model warm-up.

## MS MARCO evaluation: test split, 256 dimensions

Both runs evaluated 43 test queries using `mixedbread-ai/mxbai-embed-large-v1`
embeddings truncated to 256 dimensions and `BAAI/bge-reranker-v2-m3`. The top
200 retrieved chunks were passed to the reranker. The repository's MS MARCO
indexing path selects documents referenced by dev and test qrels, rather than
the full corpus. Initial retrieval was evaluated at `k = 1, 5, 10, 30`;
reranked retrieval was evaluated at `k = 1, 3, 5, 10`.

### Vector retrieval

Run with `make evaluate RETRIEVER=vector SPLIT=test DIM=256`.

| Metric | Initial retrieval | Reranked retrieval |
| --- | ---: | ---: |
| NDCG@1 | 0.8488 | 0.8062 |
| NDCG@3 | — | 0.7821 |
| NDCG@5 | 0.7795 | 0.7793 |
| NDCG@10 | 0.7457 | 0.7721 |
| NDCG@30 | 0.7354 | — |
| MAP@1 | 0.0256 | 0.0237 |
| MAP@3 | — | 0.0700 |
| MAP@5 | 0.1037 | 0.1066 |
| MAP@10 | 0.1647 | 0.1813 |
| MAP@30 | 0.3329 | — |
| Recall@1 | 0.0256 | 0.0237 |
| Recall@3 | — | 0.0704 |
| Recall@5 | 0.1066 | 0.1094 |
| Recall@10 | 0.1756 | 0.1925 |
| Recall@30 | 0.3829 | — |
| P@1 | 0.9767 | 0.9535 |
| P@3 | — | 0.9302 |
| P@5 | 0.8977 | 0.9163 |
| P@10 | 0.8349 | 0.8837 |
| P@30 | 0.7248 | — |

| Stage | Total | Per query |
| --- | ---: | ---: |
| Initial retrieval | 3.27 s | 76.01 ms |
| Reranking | 23.39 s | 543.98 ms |
| Both stages | 26.66 s | — |

### Hybrid retrieval (dense + BM25)

Run with `make evaluate RETRIEVER=hybrid SPLIT=test DIM=256`.

| Metric | Initial retrieval | Reranked retrieval |
| --- | ---: | ---: |
| NDCG@1 | 0.7132 | 0.8062 |
| NDCG@3 | — | 0.7821 |
| NDCG@5 | 0.7134 | 0.7793 |
| NDCG@10 | 0.7015 | 0.7700 |
| NDCG@30 | 0.6962 | — |
| MAP@1 | 0.0216 | 0.0237 |
| MAP@3 | — | 0.0700 |
| MAP@5 | 0.0924 | 0.1066 |
| MAP@10 | 0.1563 | 0.1807 |
| MAP@30 | 0.3157 | — |
| Recall@1 | 0.0216 | 0.0237 |
| Recall@3 | — | 0.0704 |
| Recall@5 | 0.0983 | 0.1094 |
| Recall@10 | 0.1724 | 0.1907 |
| Recall@30 | 0.3750 | — |
| P@1 | 0.8837 | 0.9535 |
| P@3 | — | 0.9302 |
| P@5 | 0.8512 | 0.9163 |
| P@10 | 0.8233 | 0.8814 |
| P@30 | 0.7054 | — |

| Stage | Total | Per query |
| --- | ---: | ---: |
| Initial retrieval | 5.15 s | 119.77 ms |
| Reranking | 24.02 s | 558.63 ms |
| Both stages | 29.17 s | — |

Timings exclude model warm-up.
