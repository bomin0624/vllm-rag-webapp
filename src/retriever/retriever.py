from functools import lru_cache

from langchain_chroma import Chroma
from langchain_classic.retrievers import EnsembleRetriever
from langchain_community.retrievers import BM25Retriever
from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain_core.documents import Document
from langsmith import traceable
from sentence_transformers import CrossEncoder

from src.config import (
    DATASET,
    EMBEDDING_MODEL,
    RERANK_RETURN_N,
    RERANKER_MODEL,
    RETRIEVER_TYPE,
    SEARCH_K,
)
from src.retriever.utils import (
    build_bm25_documents,
    build_embedding_model,
    rerank_documents,
    tokenize_bm25,
)


class MatchingBM25Retriever(BM25Retriever):
    def _get_relevant_documents(
        self,
        query: str,
        *,
        run_manager: CallbackManagerForRetrieverRun,
    ) -> list[Document]:
        tokens = self.preprocess_func(query)
        if not tokens:
            return []

        # Score every indexed chunk against the query tokens.
        scores = self.vectorizer.get_scores(tokens)
        query_terms = set(tokens)

        matched = [
            i
            for i, term_counts in enumerate(self.vectorizer.doc_freqs)
            if query_terms.intersection(term_counts)
        ]
        matched.sort(key=lambda i: scores[i], reverse=True)
        return [self.docs[i] for i in matched[: self.k]]


class RAGRetriever:
    def __init__(
        self,
        db_directory: str,
        embedding_model: str,
        reranker_model: str,
        search_k: int,
    ):
        self.embedding = build_embedding_model(embedding_model)
        self.vector_store = Chroma(
            persist_directory=db_directory,
            embedding_function=self.embedding,
            collection_name=DATASET,
        )
        self.search_k = search_k
        # https://zenn.dev/pipon_tech_blog/articles/8cdb27830236c5
        self.retriever = self.vector_store.as_retriever(
            search_kwargs={"k": search_k}
        )
        print(f"Loading reranker model: {reranker_model}")
        self.reranker = CrossEncoder(
            reranker_model, model_kwargs={"dtype": "float16"}
        )

    @traceable(name="retrieve-and-rerank", run_type="retriever")
    def retrieve_and_rerank(
        self, query: str, top_n: int = RERANK_RETURN_N
    ) -> list[Document]:
        initial_docs = self.retriever.invoke(query)[: self.search_k]
        reranked_docs = rerank_documents(
            query, initial_docs, self.reranker, top_n=top_n
        )
        return reranked_docs


class HybridRetriever(RAGRetriever):
    """
    A retriever that combines both vector search and sparse search (BM25).
    """

    def __init__(
        self,
        db_directory: str,
        embedding_model: str,
        reranker_model: str,
        search_k: int,
    ):
        super().__init__(
            db_directory, embedding_model, reranker_model, search_k
        )

        # Get the raw collection data to use for BM25.
        collection = self.vector_store.get()
        documents = build_bm25_documents(collection)

        bm25_retriever = MatchingBM25Retriever.from_documents(
            documents, preprocess_func=tokenize_bm25
        )
        bm25_retriever.k = search_k

        self.retriever = EnsembleRetriever(
            retrievers=[self.retriever, bm25_retriever], weights=[0.7, 0.3]
        )  # Reciprocal Rank Fusion (RRF) Algorithm


RETRIEVER_CLASSES = {
    "vector": RAGRetriever,
    "hybrid": HybridRetriever,
}


# Using LRU cache to store the retriever instance
# for efficient reuse across multiple calls
@lru_cache(maxsize=1)
def get_retriever(db_directory: str) -> RAGRetriever:
    """Gets or creates a cached RAGRetriever instance."""
    try:
        retriever_class = RETRIEVER_CLASSES[RETRIEVER_TYPE]
    except KeyError as e:
        allowed = ", ".join(RETRIEVER_CLASSES)
        raise ValueError(
            f"Invalid RETRIEVER_TYPE: {RETRIEVER_TYPE!r}. "
            f"Choose one of: {allowed}"
        ) from e

    return retriever_class(
        db_directory=db_directory,
        embedding_model=EMBEDDING_MODEL,
        reranker_model=RERANKER_MODEL,
        search_k=SEARCH_K,
    )
