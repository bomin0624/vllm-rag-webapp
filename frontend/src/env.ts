import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_API_BASE_URL: {
		public: true,
		static: true,
		// Local development may omit this; vite.config.ts requires it for builds.
		schema: (value: string | undefined) => value ?? ''
	}
});
