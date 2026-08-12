import type Provider from '../../provider/interface.ts';

import type Web from '../web.ts';

import Ui, {
	DeferredModFetch,
} from './lit.ts';

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
		'head > link[rel="modulepreload"][href*="/thread-"]',
	);

	if (!thread_source) {
		throw new Error(`Could not find thread source!`);
	}

	customElements.define('satisfactory-dev-mods-deferred', DeferredModFetch);

	const web = new Web(
		[...document.querySelectorAll<HTMLLinkElement>(
			'head > link[rel="preload"][as="fetch"]',
		)].map((e) => e.href),
		new URL(
			thread_source.href,
			import.meta.url,
		),
	);

	const search = web.search;

	(
		globalThis as (
			& typeof globalThis
			& {
				mods: typeof search,
			}
		)
	).mods = search;

	const ui = new Ui({
		target: document.querySelector('main'),
		search,
		provider,
		initial_query: params,
		has_source_linked: web.has_source_linked,
	});

	ui.init();

	addEventListener('popstate', () => {
		ui.params = new URLSearchParams(location.search);
	});
};
