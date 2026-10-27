from langchain_core.documents import Document

from src.retriever.retriever import MatchingBM25Retriever
from src.retriever.utils import tokenize_bm25


def make_retriever() -> MatchingBM25Retriever:
    documents = [
        Document(
            page_content="Statins, and breast cancer!",
            metadata={"id": "MED-1"},
        ),
        Document(
            page_content="Leucine intake study.", metadata={"id": "MED-2"}
        ),
        Document(
            page_content="Cardiovascular exercise.", metadata={"id": "MED-3"}
        ),
    ]
    retriever = MatchingBM25Retriever.from_documents(
        documents, preprocess_func=tokenize_bm25
    )
    retriever.k = len(documents)
    return retriever


def test_bm25_matches_case_and_punctuation_without_changing_document_text():
    results = make_retriever().invoke("STATINS? breast-cancer")

    assert [document.metadata["id"] for document in results] == ["MED-1"]
    assert results[0].page_content == "Statins, and breast cancer!"


def test_bm25_excludes_zero_match_candidates():
    retriever = make_retriever()

    results = retriever.invoke("leucine")
    assert [document.metadata["id"] for document in results] == ["MED-2"]
    assert retriever.invoke("unrelatedterm") == []
    assert retriever.invoke("?!") == []
