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
<link
	rel="modulepreload"
	as="script"
	href="./thread.js"
	crossorigin="anonymous"
>
<link
	rel="modulepreload"
	as="script"
	href="./web.js"
	crossorigin="anonymous"
>
${sources.map((source) => html`<link
	rel="preload"
	as="fetch"
	href="${source}"
	crossorigin="anonymous"
>`)}
<style>
:root
{
	color-scheme: dark light ;
	color: light-dark(#000, #fff) ;
	font-family: system-ui ;
}

*,
::before,
::after
{
	font-size: inherit ;
	font-family: inherit ;
	box-sizing: border-box ;
	margin: 0 ;
	padding: 0 ;
}

ul,
ol
{
	list-style: inside none ;
}

#search > fieldset > ul
{
	display: flex ;
	flex-wrap: wrap ;

	&,
	> li
	{
		padding: .25em ;
	}
}

#tags
{
	display: flex ;
	flex-wrap: wrap ;

	> li
	{
		position: relative ;
		margin: .125em ;

		&:focus-within > aside,
		> label:hover ~ aside
		{
			display: block ;
		}

		> input
		{
			display: none ;

			&:checked + label::before
			{
				background: light-dark(#000, #fff) ;
				color: light-dark(#fff, #000) ;
			}
		}

		> aside
		{
			position: absolute ;
			top: 100% ;
			left: 0 ;
			display: none ;
			background: light-dark(#fff, #000) ;
			z-index: 2 ;
			min-width: min(400px, 80vw) ;
			padding: .25em ;
		}

		> label
		{
			border: 1px solid ;
			padding: .25em ;
			padding-left: calc(.25em + 1ch + .25em + 1px + .25em) ;
			display: block ;
			position: relative ;

			&::before
			{
				content: '#' ;
				border-right: 1px solid ;
				padding: .25em ;
				margin-right: .25em ;
				position: absolute ;
				top: 0 ;
				left: 0 ;
			}
		}
	}
}
</style>
</head>
<body>
<script type="module">
import init from './ui.js';

const params = new URLSearchParams(location.search);

const url = new URL(import.meta.url);
url.search = '';

document.addEventListener('DOMContentLoaded', () => {
	import('./web.js').then(({default: Web}) => {
		init({
			Web,
			params,
			api_cache_root: url + '/api/',
		});
	});
});
</script>
</body>
</html>`;

await writeFile(
	`${import.meta.dirname}/dist/index.html`,
	await htmldoc(index),
);
