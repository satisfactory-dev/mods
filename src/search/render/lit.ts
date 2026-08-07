import type {
	IndexResult,
} from '@satisfactory-dev/lunr';

import type {
	TemplateResult,
} from 'lit';
import {
	css,
	html,
	LitElement,
	render,
} from 'lit';

import {
	repeat,
} from 'lit/directives/repeat.js';

import {
	until,
} from 'lit/directives/until.js';

import {
	when,
} from 'lit/directives/when.js';

import {
	IntersectionController,
} from '@lit-labs/observers/intersection-controller.js';

import type Search from '../../search.ts';

import type {
	result as Mod,
} from '../../api/getMod--reduced.ts';

import {
	assert_non_empty,
} from '../../helper/array.ts';

import type Provider from '../../provider/interface.ts';

import tags from '../../../.cache/api/tags.json' with {type: 'json'};

import _mod_ids from '../../../.cache/indexed-mod-ids.json' with {
	type: 'json',
};

type DeferredModItem = (
	& HTMLDivElement
	& {
		getAttribute(attr: 'part'): 'mod',
		getAttribute(attr: string): string | undefined,
		dataset: (
			& DOMStringMap
			& {
				ref: Mod['id'],
				score: IndexResult['score'],
			}
		),
	}
);

export class DeferredModFetch extends LitElement {
	static styles = css`
		:host
		{
			display: block ;
			min-height: 1ch ;

			&:empty
			{
				min-height: 0 ;
			}
		}

		[part="mod"]
		{
			display: block ;
			min-height: 1ch ;
		}
	`;

	static properties = {
		results: {
			type: Array,
		},
		provider: {
			type: Object,
		},
	};

	results!: IndexResult[];

	provider!: Provider;

	#controller!: IntersectionController<Set<Mod['id']>>;

	constructor() {
		super();

		let controller: IntersectionController<
			Set<Mod['id']>
		>;

		controller = new IntersectionController<
			Set<Mod['id']>
		>(this, {
			callback: (entries) => {
				const fresh = new Set<Mod['id']>(
					controller.value || [],
				);

				for (const entry of entries) {
					if ('mod' === entry.target.getAttribute('part')) {
						const id = (
							entry.target as DeferredModItem
						).dataset.ref;

						if (entry.isIntersecting) {
							fresh.add(id);
						} else {
							fresh.delete(id);
						}
					}
				}

				return fresh;
			},
			skipInitial: false,
		});

		this.#controller = controller;
	}

	connectedCallback(): void {
		super.connectedCallback();

		if (!this.provider) {
			throw new Error('API provider not set!');
		}

		if (!this.results) {
			throw new Error(`IndexResult instances not set!`);
		}

		this.setAttribute('role', 'list');
	}

	render() {
		return html`${
			repeat(
				this.results,
				({ref}) => ref,
				(
					result,
				) => html`<div
					data-ref="${result.ref}"
					data-score="${result.score}"
					role="listitem"
					part="mod"
				>${when(
					this.#controller.value?.has(result.ref) ?? false,
					() => until(
						this.#fetch(result.ref),
						'...loading',
					),
					() => '👀',
				)}</div>`,
			)
		}`;
	}

	async #fetch(id: Mod['id']): Promise<TemplateResult> {
		const mod = await this.provider.getMod(id);

		return html`${mod.name}`;
	}

	updated(changed_properties: Map<string, unknown>) {
		super.updated(changed_properties);

		for (const item of (
			this.shadowRoot?.querySelectorAll('[part="mod"]') || [])
		) {
			this.#controller.observe(item);
		}
	}
}

assert_non_empty(_mod_ids);

const mod_ids = _mod_ids;

export default class Ui {
	#debounce: (
		| undefined
		| ReturnType<typeof setTimeout>
	) = undefined;

	#debounced: (
		| undefined
		| true
		| Awaited<ReturnType<Search['search']>>
		| Error
	) = undefined;

	#search: Search;

	#target: HTMLElement;

	#initial_query: string;

	#hide_filters = true;

	#provider: Provider;

	constructor({
		target,
		search,
		initial_query,
		provider,
	}: {
		target: HTMLElement,
		search: Search,
		provider: Provider,
		initial_query?: string,
	}) {
		this.#target = target;
		this.#search = search;
		this.#provider = provider;
		this.#initial_query = initial_query || '';
	}

	get template() {
		return html`<form id="search">
			<fieldset>
				<ul>
					<li>
						<button
							type="button"
							aria-expanded="false"
							aria-controls="filters"
						>Filter...</button>
					</li>
					<li>
						<input
							type="search"
							aria-label="Search query for mods"
							name="q"
							value="${this.#initial_query}"
						>
					</li>
				</ul>
				<fieldset
					id="filters"
					?hidden="${this.#hide_filters}"
					aria-label="Search Filters"
				>
					<ul
						id="tags"
						aria-label="Tags"
					>${repeat(Object.entries(tags), ([id]) => id, ([
						id,
						{
							name,
							description,
						},
					]) => html`<li>
						<input
							name="tags[]"
							value="${id}"
							id="tag-${id}"
							type="checkbox"
						>
						<label
							for="tag-${id}"
							aria-describedby="tag-tooltip-${id}"
						>${name}</label>
						<aside
							id="tag-tooltip-${id}"
							role="tooltip"
						>${description}</aside>
					</li>`)}</ul>
				</fieldset>
			</fieldset>
		</form><output form="search">${when(
			this.#debounced,
			() => when(
				this.#debounced,
				() => when(
					true === this.#debounced,
					() => html`<p>...searching</p>`,
					() => when(
						!(this.#debounced instanceof Error),
						() => html`<satisfactory-dev-mods-deferred
							.provider=${this.#provider}
							.results=${this.#debounced}
						></satisfactory-dev-mods-deferred>`,
						() => html`<p>An error occurred!</p>`,
					),
				),
			),
		)}</output>`;
	}

	#render() {
		render(this.template, this.#target);
	}

	#debounced_search(
		form: HTMLFormElement,
		target: true | HTMLElement,
		search: string,
	) {
		if (
			true !== target
			&& !Ui.#should_run_search(target, search)
		) {
			return;
		}

		const search_value = search.trim();

		this.#debounced = undefined;

		clearTimeout(this.#debounce);

		this.#render();

		this.#debounce = setTimeout(() => {
			this.#debounced = true;

			void this.#search.search(
				search_value,
				[...form.querySelectorAll<HTMLInputElement>(
					'input[name="tags[]"]:checked',
				)].map((e) => e.value),
				[],
				'' === search_value ? mod_ids : undefined,
			)
				.then(
					(results) => {
						console.log(results);

						this.#debounced = results;

						this.#render();
					},
				)
				.catch((err) => {
					console.error(err);

					this.#debounced = new Error('An error occurred');

					this.#render();
				});

			this.#render();
		}, 100);
	}

	init() {
		this.#render();

		const form = this.#target.querySelector('form');

		if (!form) {
			throw new Error('Could not find form!');
		}

		const filters = form.querySelector<HTMLFieldSetElement>('#filters');
		const search = form.querySelector<(
			& HTMLInputElement
			& {type: 'search'}
		)>('input[type="search"]');

		if (!filters) {
			throw new Error('Could not find filters!');
		}

		if (!search) {
			throw new Error('Could not find search input!');
		}

		form.addEventListener('input', ({target}) => {
			this.#debounced_search(
				form,
				target as HTMLElement,
				search.value,
			);
		});

		form.addEventListener('click', (e) => {
			if (!Ui.#is_filter_button(e.target)) {
				return;
			}

			const state = 'true' === e.target.getAttribute('aria-expanded');

			this.#hide_filters = state;
			e.target.setAttribute('aria-expanded', state ? 'false' : 'true');
			this.#render();
		});

		this.#debounced_search(
			form,
			true,
			this.#initial_query,
		);
	}

	static #is_filter_button(maybe: unknown): maybe is HTMLButtonElement {
		return (
			(maybe instanceof HTMLButtonElement)
			&& maybe.matches('button[aria-controls="filters"')
		);
	}

	static #should_run_search(
		maybe: unknown,
		search_value: string,
	): maybe is HTMLInputElement {
		return (
			'' !== search_value.trim()
			&& (
				true === maybe
				|| (
					(maybe instanceof HTMLElement)
					&& (
						maybe.matches('input[type="search"]')
						|| maybe.matches('input[name="tags[]"]')
					)
				)
			)
		);
	}
}
