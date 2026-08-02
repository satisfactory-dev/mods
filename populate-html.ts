import {
	basename,
} from 'node:path';

import {
	glob,
	writeFile,
} from 'node:fs/promises';

import type {
	TemplateResult,
} from 'lit';
import {
	html,
} from 'lit';

import {
	render,
} from '@lit-labs/ssr';

import {
	collectResult,
} from '@lit-labs/ssr/lib/render-result.js';

import type {
	source,
} from './src/search/web.ts';
import Web from './src/search/web.ts';

const sources: source[] = [];

for await (const path of glob(`${import.meta.dirname}/dist/*.json`)) {
	const file = `./${basename(path)}`;

	if (Web.is_source(file)) {
		sources.push(file);
	}
}

export async function htmldoc(
	result: TemplateResult,
): Promise<string> {
	let html = await collectResult(render(result));

	html = html.replaceAll(
		/<!--\/?lit-(part|node)[^>]+>/g,
		'',
	);

	return html
		.replace(/^\s+$/gm, '')
		.replace(/\n{2,}/g, '\n')
		.replaceAll('<?>', '')
		.trim();
}

const index = html`<html>
<head>
<link rel="preload" as="script" href="./thread.js">
<link rel="preload" as="script" href="./web.js">
${sources.map((source) => html`<link
	rel="preload"
	as="fetch"
	href="${source}"
>`)}
</head>
<body>
<script type="module">
import Ui from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
	import('./web.js').then(({default: Web}) => {
		const search = (new Web(
			[...document.querySelectorAll(
				'head > link[rel="preload"][as="fetch"]',
			)].map((e) => e.href),
			new URL(
				document.querySelector(
					'head > link[rel="preload"][href$="/thread.js"]'
				).href,
				import.meta.url,
			),
		)).search;

		globalThis.mods = search;

		(new Ui(
			document.body,
			search,
			import.meta.url + '/api/',
		)).init();
	});
});
</script>
</body>
</html>`;

await writeFile(
	`${import.meta.dirname}/dist/index.html`,
	await htmldoc(index),
);
