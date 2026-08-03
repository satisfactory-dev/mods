import type Provider from '../../provider/interface.ts';

import type Web from '../web.ts';

import Ui from './lit.ts';

export default ({
	Web,
	params,
	provider,
}: {
	Web: new (
		...params: Parameters<
			typeof Web.prototype.constructor
		>
	) => Web,
	params: URLSearchParams,
	provider: Provider,
}) => {
	const thread_source = document.querySelector<HTMLLinkElement>(
		'head > link[rel="modulepreload"][href$="/thread.js"]',
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
		provider,
		initial_query: params.get('q') || '',
	})).init();
};
