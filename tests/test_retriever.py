from types import SimpleNamespace

from langchain_core.documents import Document

from src.retriever.retriever import RAGRetriever


def test_retrieve_caps_fused_chunks_at_search_k():
    documents = [Document(page_content=str(i)) for i in range(5)]
    retriever = RAGRetriever.__new__(RAGRetriever)
    retriever.search_k = 2
    retriever.retriever = SimpleNamespace(invoke=lambda _: documents)

    assert retriever.retrieve("query") == documents[:2]
