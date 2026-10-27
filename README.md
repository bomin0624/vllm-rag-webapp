# RAG Web App

A local retrieval-augmented generation (RAG) web application with a **SvelteKit
frontend**, a **FastAPI backend**, and a **vLLM inference server**. The backend
indexes the BEIR `nfcorpus` dataset in Chroma, combines semantic and keyword
retrieval, reranks relevant passages, and calls a locally served model to
generate an answer with its supporting source documents.

The frontend runs separately from Docker Compose and communicates directly with
the FastAPI service over HTTP/JSON. Docker Compose runs the two GPU-enabled
backend services: `rag-api` and `vllm`.

## System Architecture

![System architecture](assets/system_architecture.png)

The vector database is created automatically on the first application start.
The build downloads `nfcorpus`, splits its documents into 2,048-character
chunks with 300-character overlap, and stores 512-dimensional normalized
embeddings in `vectordatabase/`.

## Requirements

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- Node.js 22.17+ and npm
- Docker Desktop with Compose
- An NVIDIA GPU, effectively required by vLLM


## LLM server

Answer generation goes through the `LLMClient` protocol in `src/model.py`,
implemented against vLLM's OpenAI-compatible `/v1` API. Configure it with
environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `LLM_BASE_URL` | `http://localhost:8001` | vLLM server URL. |
| `LLM_TIMEOUT` | `120` | Request timeout in seconds. |
| `GENERATE_MODEL` | `Qwen/Qwen2.5-1.5B-Instruct` | Hugging Face repo id vLLM was launched with. |
| `LLM_API_KEY` | `EMPTY` | Only used if vLLM was started with `--api-key`. |

vLLM names models by the Hugging Face repo id it was served with, so
`GENERATE_MODEL` has to match what the `vllm` service was launched with. Both
read the same variable, so setting it once keeps them together.


## Run locally

Install the Python dependencies:

```bash
make install
```

Then start the vLLM container and the API with hot reload in one step:

```bash
make vllm
```

| Step | `make vllm` |
| --- | --- |
| Start the container | `docker compose up -d vllm` |
| Wait until ready | poll `localhost:8001/health` |
| Fetch the model | downloaded on first serve |
| Serve the app | `uvicorn --reload` on `localhost:8000` |


### Running the steps separately

`make vllm` is a composition of smaller targets, each usable on its own:

```bash
make backend-only        # just the vLLM container
make wait-backend        # block until it answers
make run                 # just the FastAPI app
make backend-down        # stop the API and vLLM
```

## Run with Docker Compose

To run the API in Docker as well, `make backend` starts both containers:

```bash
make backend
```

Or by hand:

```bash
docker compose up --build -d
```

The API waits for vLLM's health check before it starts. Inside the Compose
network it reaches vLLM by service name, so it runs with
`LLM_BASE_URL=http://vllm:8000`.

Compose persists datasets, Chroma data, and logs in the local `datasets/`,
`vectordatabase/`, and `log/` directories.

### Docker Compose

Create a `.env` file in the repository root with your LangSmith API key:

```dotenv
LANGSMITH_API_KEY=your_langsmith_api_key
```

`docker-compose.yml` already enables tracing and sets the project name to
`rag-dev`:

```text
LANGSMITH_TRACING=true
LANGSMITH_PROJECT=rag-dev
```

Start the stack with `make backend`, then view the `rag-dev` project in
LangSmith.

## Open the frontend

Start the API and vLLM using `make vllm` or `make backend` as described above.
If you use `make vllm`, leave that terminal running. Once the API is ready at
`http://localhost:8000`, open a separate terminal and run these commands from
the repository root:

```bash
cd frontend
npm ci
npm run dev
```

## LangSmith tracing

The answer-generation chain is instrumented with LangSmith as `rag-query`.
When tracing is enabled, each `/query` request produces a trace containing the
retrieval-backed prompt and vLLM's generation call.

### View traces in LangSmith

1. Open [LangSmith](https://smith.langchain.com/) and sign in to the workspace
   associated with `LANGSMITH_API_KEY`.
2. Send a request to `POST /query` (for example, from the FastAPI Swagger UI at
   [http://localhost:8000/docs](http://localhost:8000/docs)).
3. In LangSmith, open **Projects** and select `rag-dev`. The project is created
   automatically after it receives its first trace.

Each request is displayed as a `rag-query` trace with child runs for
`retrieve-and-rerank` and `llm-chat`.

### Local development

Export the variables before starting the API (shown with POSIX shell syntax):

```bash
export LANGSMITH_API_KEY=your_langsmith_api_key
export LANGSMITH_TRACING=true
export LANGSMITH_PROJECT=rag-dev
make run
```

Do not commit `.env` or your API key. Tracing is optional; omit these variables
when you do not want to send run data to LangSmith.

## API

### Health check

```bash
curl http://localhost:8000/health
```

Response:

```json
{"status":"ok"}
```

### Query the knowledge base

```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"query":"Living Longer by Reducing Leucine Intake"}'
```

The request body accepts exactly one field, `query`, after trimming whitespace.
It must contain between 1 and 1,000 characters.

```json
{
  "answer": "Generated answer based on the retrieved context.",
  "sources": [
    {
      "id": "MED-10",
      "title": "Example source title",
      "content": "The retrieved source passage..."
    }
  ],
  "model": "Qwen/Qwen2.5-1.5B-Instruct"
}
```

## Development and evaluation

```bash
make format       # Format and apply safe Ruff fixes
make format-check # Verify formatting and lint rules
make lint         # Run Ruff
make test         # Run the unit tests
make ci           # Run format checks and tests
```

Evaluate retrieval quality against BEIR qrels:

```bash
make evaluate
make evaluate RETRIEVER=vector SPLIT=test DIM=256
```

`RETRIEVER` may be `hybrid` or `vector`; `SPLIT` may be `train`, `dev`, or
`test`. `DIM` sets `EMBED_TRUNCATE_DIM` for the run and must match the
dimension used to build `vectordatabase/` — otherwise the pre-check raises a
mismatch error and you have to rebuild first with
`rm -rf vectordatabase/ && make evaluate DIM=256`, since the evaluation
initializes the database itself.

Evaluation only exercises retrieval, so vLLM does not need to be running — but
the embedding and reranker models load onto the GPU, so stop vLLM first with
`make backend-down` if it is holding the card.

### Retrieval evaluation results

The table shows initial Recall@30 and reranked NDCG@3 for each recorded run.
Full metrics, timings, commands, and index scopes are in
[Retrieval evaluation results](docs/retrieval_evaluation.md).
NFCorpus uses its full corpus; MS MARCO uses documents selected from dev and
test qrels, so compare retrievers within the same dataset and split.

| Dataset | Split | Dimensions | Retriever | Initial Recall@30 | Reranked NDCG@3 |
| --- | --- | ---: | --- | ---: | ---: |
| NFCorpus | dev | 512 | vector | 0.2395 | 0.3693 |
| NFCorpus | dev | 512 | hybrid | 0.2436 | 0.3657 |
| NFCorpus | test | 512 | vector | 0.2571 | 0.3930 |
| NFCorpus | test | 512 | hybrid | 0.2600 | **0.3954** |
| NFCorpus | dev | 256 | vector | 0.2280 | 0.3644 |
| NFCorpus | dev | 256 | hybrid | 0.2323 | 0.3642 |
| NFCorpus | test | 256 | vector | 0.2462 | 0.3899 |
| NFCorpus | test | 256 | hybrid | 0.2499 | **0.3976** |
| MS MARCO | test | 256 | vector | 0.3829 | 0.7821 |
| MS MARCO | test | 256 | hybrid | 0.3750 | 0.7821 |
