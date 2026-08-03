import type Web from '../web.ts';

import Ui from './lit.ts';

export default (
	Web: new (
		...params: Parameters<
			typeof Web.prototype.constructor
		>
	) => Web,
	params: URLSearchParams,
) => {
	const thread_source = document.querySelector<HTMLLinkElement>(
		'head > link[rel="preload"][href$="/thread.js"]',
	);

	if (!thread_source) {
		throw new Error(`Could not find thread source!`);
	}

	const search = (new Web(
		[...document.querySelectorAll<HTMLLinkElement>(
			'head > link[rel="preload"][as="fetch"]',
		)].map((e) => e.href),
		new URL(
			thread_source.href,
			import.meta.url,
		),
	)).search;

	(
		globalThis as (
			& typeof globalThis
			& {
				mods: typeof search,
			}
		)
	).mods = search;

	(new Ui({
		target: document.body,
		search,
		api_cache_root: `${import.meta.url}/api/`,
		initial_query: params.get('q') || '',
	})).init();
};
