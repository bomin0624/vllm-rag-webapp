import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const envDir = fileURLToPath(new URL('.', import.meta.url));
	const env = loadEnv(mode, envDir, 'PUBLIC_');

	return {
		plugins: [
			{
				name: 'require-api-base-url',
				apply: 'build',
				enforce: 'pre',
				buildStart() {
					if (!env.PUBLIC_API_BASE_URL?.trim()) {
						throw new Error(
							'PUBLIC_API_BASE_URL is required for builds. Set it in the build environment or in frontend/.env before running npm run build.'
						);
					}
				}
			},
			tailwindcss(),
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},

				// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
				// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
				// See https://svelte.dev/docs/kit/adapters for more information about adapters.
				adapter: adapter()
			})
		]
	};
});
