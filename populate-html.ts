import {
	hash,
} from 'node:crypto';

import {
	basename,
	dirname,
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
	unsafeStatic,
} from 'lit/static-html.js';

import {
	render,
} from '@lit-labs/ssr';

import {
	collectResult,
} from '@lit-labs/ssr/lib/render-result.js';

import Web from './src/search/web.ts';

import {
	stringify,
} from './src/helper/json.ts';

const sources: string[] = [];

for await (const path of glob(`${import.meta.dirname}/dist/data/*/*.json`)) {
	const file = `./data/${basename(dirname(path))}/${basename(path)}`;

	if (
		Web.is_source(file)
		|| Web.is_mod_ids_list(file)
	) {
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

const modulepreloads = new Set<string>();

for await (const path of glob('./dist/js/{thread, web}-*.js')) {
	modulepreloads.add(basename(path));
}

const files: {
	ui: string | undefined,
	provider: string | undefined,
	web: string | undefined,
	thread: string | undefined,
	style: string | undefined,
} = {
	ui: undefined,
	provider: undefined,
	web: undefined,
	thread: undefined,
	style: undefined,
};

for (const key of Object.keys(files)) {
	for await (const path of glob(
		`./dist/{js/${key}-*.js,css/${key}-*.css}`,
	)) {
		files[key] = basename(path);
	}

	if (!files[key]) {
		throw new Error(`Could not find ${key}`);
	}
}

const now = new Date();

const import_map = stringify({
	imports: {
		'./js/ui.js': `./js/${files.ui}`,
		'./js/provider.js': `./js/${files.provider}`,
		'./js/web.js': `./js/${files.web}`,
		'./js/thread.js': `./js/${files.thread}`,
	},
});

const import_map_hash = hash('sha256', import_map, 'base64');

const init = `import init from './js/ui.js';
import Provider from './js/provider.js';

let params = new URLSearchParams(location.search);

const url = new URL(import.meta.url);

if ('' === location.search) {
	params = undefined;
}

const provider = new Provider(url + '/api/');

document.addEventListener('DOMContentLoaded', () => {
	import('./js/web.js').then(({default: Web}) => {
		init({
			Web,
			params,
			provider,
		});
	});
});`;

const init_hash = hash('sha256', init, 'base64');

const index = html`<!DOCTYPE html>
<html
	lang="en"
>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Mods</title>
<meta
	name="description"
	content="${
		'An experimental forked search alternative of https://ficsit.app/mods.'
	}"
>
<base href="/">
<script
	type="importmap"
	integrity="sha256-${import_map_hash}"
>${unsafeStatic(import_map)}</script>
${[...modulepreloads].map((filename) => html`
<link
	rel="modulepreload"
	as="script"
	href="./js/${filename}"
	crossorigin="anonymous"
>
`)}
${sources.map((source) => html`<link
	rel="preload"
	as="fetch"
	href="${source}"
	crossorigin="anonymous"
>`)}
<link rel="stylesheet" href="./css/${files.style}">
</head>
<body>
<script
	type="module"
	integrity="sha-256,${init_hash}"
>${unsafeStatic(init)}</script>
<main></main>
<footer>
	<p>An experimental forked search alternative of <a
		target="_blank"
		href="https://ficsit.app/mods"
	>https://ficsit.app/mods</a>.</p>
	<p>Fork &copy; ${
		unsafeStatic(now.getFullYear().toString())
	} <a
		target="_blank"
		href="https://github.com/satisfactory-dev/mods/"
	>SignpostMarv</a>, last build at ${
		unsafeStatic(now.toTimeString())
	} on ${
		unsafeStatic(now.toDateString())
	}.</p>
	<p>Original data / content managed by <a
		target="_blank"
		href="https://ficsit.app/tos"
	>ficsit.app</a>.</p>
</footer>
</body>
</html>`;

await writeFile(
	`${import.meta.dirname}/dist/index.html`,
	await htmldoc(index),
	'utf8',
);
