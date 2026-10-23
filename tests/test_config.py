from runpy import run_path

import pytest

from src import config


@pytest.mark.parametrize(
    ("env_value", "expected"),
    [
        (
            None,
            ["http://localhost:5173", "http://127.0.0.1:5173"],
        ),
        (
            "https://rag.example.com,https://staging.example.com",
            ["https://rag.example.com", "https://staging.example.com"],
        ),
        (
            " https://rag.example.com , ,\thttps://staging.example.com, ",
            ["https://rag.example.com", "https://staging.example.com"],
        ),
        ("", []),
        (" \t\n ", []),
        (", ,\t,\n,", []),
    ],
    ids=[
        "defaults",
        "split",
        "strip-and-ignore-empty",
        "empty",
        "whitespace",
        "commas",
    ],
)
def test_cors_allow_origins(monkeypatch, env_value, expected):
    if env_value is None:
        monkeypatch.delenv("CORS_ALLOW_ORIGINS", raising=False)
    else:
        monkeypatch.setenv("CORS_ALLOW_ORIGINS", env_value)

    # Evaluate settings without changing the config imported by other tests.
    settings = run_path(config.__file__)

    assert settings["CORS_ALLOW_ORIGINS"] == expected
