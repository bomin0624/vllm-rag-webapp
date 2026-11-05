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


def test_bm25_ranks_noncontiguous_matches_by_score():
    documents = [
        Document(page_content="leucine"),
        Document(page_content="unrelated"),
        Document(page_content="other"),
        Document(page_content="leucine leucine leucine"),
        Document(page_content="misc"),
    ]
    retriever = MatchingBM25Retriever.from_documents(
        documents, preprocess_func=tokenize_bm25
    )
    retriever.k = 2

    assert [doc.page_content for doc in retriever.invoke("leucine")] == [
        "leucine leucine leucine",
        "leucine",
    ]


def test_bm25_ranks_by_score_and_caps_at_k():
    texts = [
        "statins statins statins",
        "statins diet diet",
        "statins statins diet",
        "diet exercise sleep",
        "running exercise sleep",
        "sleep quality study",
        "exercise heart study",
    ]
    documents = [
        Document(page_content=text, metadata={"id": str(i)})
        for i, text in enumerate(texts)
    ]
    retriever = MatchingBM25Retriever.from_documents(
        documents, preprocess_func=tokenize_bm25
    )
    retriever.k = 2

    results = retriever.invoke("statins")

    assert [document.metadata["id"] for document in results] == ["0", "2"]
