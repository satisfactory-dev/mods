import {
	defineConfig,
} from 'rolldown';

export default defineConfig([
	{
		input: {
			web: './src/search/web.ts',
			thread: './src/search/thread.ts',
			ui: './src/search/render/lit--init.ts',
		},
		output: {
			format: 'esm',
			dir: 'dist',
			minify: false,
			sourcemap: false,
			codeSplitting: {
				groups: [
					{
						name: 'ajv',
						test: /ajv/,
					},
					{
						name: 'lunr',
						test: /node_modules\/@satisfactory-dev\/lunr\//,
					},
					{
						name: 'lit',
						test: /node_modules\/lit\//,
					},
				],
			},
		},
	},
]);
