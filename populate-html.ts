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

import Web from './src/search/web.ts';

const sources: string[] = [];

for await (const path of glob(`${import.meta.dirname}/dist/*.json`)) {
	const file = `./${basename(path)}`;

	if (
		Web.is_source(file)
		|| Web.is_mod_ids_list(file)
	) {
		sources.push(file);
	}
}

for await (const path of glob(`${import.meta.dirname}/dist/mod-ids/*.json`)) {
	const file = `./${basename(path)}`;

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

const index = html`<html
	lang="en"
>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1" />
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

#tags,
.tags
{
	display: flex ;
	flex-wrap: wrap ;

	> li
	{
		position: relative ;
		margin: .125em ;
	}
}

#tags > li > label,
.tags > li
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

#tags
{
	> li
	{
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
	}
}

satisfactory-dev-mods-deferred
{
	display: flex ;
	flex-wrap: wrap ;

	padding: 1ch ;

	a
	{
		text-decoration: none ;
	}

	> [role="listitem"]
	{
		display: grid ;
		grid-template: 'logo header' 'logo section' 'logo footer' ;
		grid-template-columns: min(calc(100% * (200 / 550)), 200px) ;
		grid-column-gap: 1ch ;
		width: 100% ;
		max-width: min(calc(50% - 2ch), 550px) ;
		margin: 1ch ;
		padding: 1ch ;
		outline: 1px solid ;
		border-radius: 0 1em 1em 1em ;

		> header,
		> section,
		> footer
		{
			padding: .5ch ;
		}

		> header
		{
			grid-area: header ;

			> ul
			{
				display: flex ;
				flex-wrap: wrap ;

				li:not(:first-child):not(.compatibility)
				{
					margin-left: 1ch ;
				}
			}

			.compatibility
			{
				display: block ;
				width: 100% ;
				margin-top: 1ch ;

				> ul
				{
					display: flex ;

					> li
					{
						outline: 1px solid ;
						display: flex ;
						justify-content: center ;
					}

					> [aria-label="Controller"]::before,
					.icon
					{
						filter:
							grayscale(1)
							sepia(1)
							contrast(.2)
							saturate(1)
						;
					}

					.icon
					{
						&[aria-label="Works"]
						{
							filter:
								grayscale(1)
								sepia(1)
								contrast(.2)
								saturate(20)
								hue-rotate(45deg)
							;
						}

						&[aria-label="Unsupported"]
						{
							filter:
								grayscale(1)
								sepia(1)
								contrast(.2)
								saturate(20)
								hue-rotate(-45deg)
							;
						}

						&[aria-label="Untested"]
						{
							filter:
								grayscale(1)
								sepia(1)
								contrast(.2)
								saturate(20)
								hue-rotate(-22.5deg)
							;
						}
					}

					.icon,
					> ::before
					{
						display: inline-block ;
						margin-right: .125em ;
						padding: .125em ;
					}

					> [aria-label="Stable"]::before
					{
						content: 'EA' ;
					}

					> [aria-label="Experimental"]::before
					{
						content: 'EXP' ;
					}
					> [aria-label="Controller"]::before
					{
						content: '🎮' ;
					}
				}
			}
		}

		> section
		{
			grid-area: section ;
		}

		> .has-image,
		> .as-image
		{
			display: block ;
			grid-area: logo ;
			width: 100% ;
			margin: auto .5ch auto 0 ;
		}

		> .has-image > img
		{
			display: block ;
			width: 100% ;
			height: auto ;
		}

		> footer
		{
			grid-area: footer ;
			display: flex ;
			align-items: flex-end ;
			justify-content: flex-end ;
		}
	}
}
</style>
</head>
<body>
<script type="module">
import init from './ui.js';
import Provider from './provider.js';

const params = new URLSearchParams(location.search);

const url = new URL(import.meta.url);
url.search = '';

const provider = new Provider(url + '/api/');

document.addEventListener('DOMContentLoaded', () => {
	import('./web.js').then(({default: Web}) => {
		init({
			Web,
			params,
			provider,
		});
	});
});
</script>
</body>
</html>`;

await writeFile(
	`${import.meta.dirname}/dist/index.html`,
	await htmldoc(index),
	'utf8',
);
