# RAG frontend

The frontend uses SvelteKit, Vite, and npm. Run the following commands from `frontend/`.

## Developing

Install dependencies and start the app:

```sh
npm ci
npm run dev
```

No `.env` file is required for local development. If `PUBLIC_API_BASE_URL` is
missing, empty, or whitespace-only, the app uses `http://localhost:8000`. Start the
Python RAG API at that address.

To use a different API address, create a local environment file and update its
`PUBLIC_API_BASE_URL` value:

```sh
cp .env.example .env
```

`.env` is ignored by Git. Explicitly configured addresses are used instead of the
development default.

## Checks

```sh
npm run check
npm run lint
```

## Building and deployment

`PUBLIC_API_BASE_URL` is required for every build, including builds that use
`--mode development`. Missing, empty, or whitespace-only values stop the build
with a configuration error. The localhost default is only available in the
development server.

For AWS or another deployment environment, set `PUBLIC_API_BASE_URL` to the API's
public address in the build environment, then run:

```sh
npm ci
npm run build
```

For example, a build from a local shell can use:

```sh
PUBLIC_API_BASE_URL=https://api.example.com npm run build
```

Process environment variables override values from `.env` files. `npm run check`
works without `.env`; CI builds must provide `PUBLIC_API_BASE_URL` explicitly.

The API address is embedded in the frontend at build time through
`$env/static/public`. Build separately for staging and production if they use
different API addresses, and rebuild when the address changes. Changing a server's
environment variable after the build does not update the frontend.

Use localhost only for local development: in the browser, localhost refers to the
user's computer. `PUBLIC_` variables are visible to users and must not contain
secrets.

You can preview the built app with `npm run preview`; it uses the address already
embedded in the build and does not require the variable to be set again.

Before deploying, select a SvelteKit [adapter](https://svelte.dev/docs/kit/adapters)
for the hosting environment. The project currently uses `adapter-auto`; setting
the API address alone does not configure AWS hosting.
