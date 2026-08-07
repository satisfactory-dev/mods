import type {
	IndexResult,
} from '@satisfactory-dev/lunr';

import type {
	TemplateResult,
} from 'lit';
import {
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
	classMap,
} from 'lit/directives/class-map.js';

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
		dataset: (
			& DOMStringMap
			& {
				ref: Mod['id'],
				score: IndexResult['score'],
			}
		),
	}
);

type ModContent = {
	name: string,
	data: Mod,
};

export class DeferredModFetch extends LitElement {
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
					if ('ref' in (
						entry.target as HTMLElement
					).dataset) {
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

	protected createRenderRoot() {
		return this;
	}

	#conditionally<
		K extends keyof Exclude<ModContent['data'], undefined>,
	>(
		icon: string,
		data: ModContent['data'] | undefined,
		prop: K,
		alt?: (value: Exclude<ModContent['data'][K], null>) => TemplateResult,
	) {
		return html`${when(
			icon,
			() => html`<span aria-hidden="true">${icon}</span>`,
		)}${when(
			data,
			(value) => when(
				alt && value[prop] ? alt : undefined,
				(cb) => html`${cb(value[prop] as Exclude<
					ModContent['data'][K],
					null
				>)}`,
				() => html`${
					'number' === typeof value[prop]
						? Intl.NumberFormat().format(value[prop])
						: value[prop]
				}`,
			),
		)}`;
	}

	#compatibility_bool<
		K extends keyof Exclude<ModContent['data']['compatibility'], null>,
	>(
		data: ModContent['data'] | undefined,
		prop: K,
		expect: Exclude<
			ModContent['data']['compatibility'],
			null
		>[K]['state'],
	) {
		if (!data?.compatibility) {
			return false;
		}

		return expect === data.compatibility[prop].state;
	}

	#content({
		name,
		data,
	}: {
		name: string,
		data?: ModContent['data'],
	}) {
		return html`<header>
			<h1>${name}</h1>
			<ul>
				<li aria-label="Views">${this.#conditionally(
					'👁️',
					data,
					'views',
				)}</li>
				<li aria-label="Downloads">${this.#conditionally(
					'⬇️',
					data,
					'downloads',
				)}</li>
				<li aria-label="Downloads">${this.#conditionally(
					'⬇️',
					data,
					'downloads',
				)}</li>
				<li aria-label="Compatibility" class="compatibility">
					<ul class=${classMap(
						Object.fromEntries(
							([
								[
									['EA', 'EXP'],
									['Works', 'Broken', 'Damaged'],
								],
								[
									['Controller'],
									[
										'Untested',
										'Unsupported',
										'Partial',
										'Implicit',
										'Supported',
									],
								],
							] as const).flatMap(([
								props,
								expects,
							]) => props.flatMap((prop) => expects.map((
								expect,
							) => [
								`${
									prop.toLowerCase()
								}-${
									expect.toLowerCase()
								}`,
								this.#compatibility_bool(
									data,
									prop,
									expect,
								),
							]))),
						),
					)}>
						<li aria-label="Stable">
						${this.#conditionally(
							'',
							data,
							'compatibility',
							({
								EA: {
									state,
								},
							}) => html`<span
								aria-label="${state}"
								class="icon"
							>${
								'Works' === state
									? '👍'
									: '👎'
							}</span>`,
						)}
						</li>
						<li aria-label="Experimental">
						${this.#conditionally(
							'',
							data,
							'compatibility',
							({
								EXP: {
									state,
								},
							}) => html`<span aria-label="${state}">${
								'Works' === state
									? '👍'
									: '👎'
							}</span>`,
						)}
						</li>
						<li aria-label="Controller">
						${this.#conditionally(
							'',
							data,
							'compatibility',
							({
								Controller: {
									state,
								},
							}) => html`<span aria-label="${state}">${
								'Supported' === state
									? '👍'
									: (
										'Untested' === state
											? '❓'
											: '👎'
									)
							}</span>`,
						)}
						</li>
					</ul>
				</li>
			</ul>
		</header>
		${when(
			data,
			(value) => html`${when(
				value.logo,
				(logo) => html`<img
					src="${logo}"
					width="1024"
					height="1024"
					loading="lazy"
				>`,
				() => html`<span
					class="as-image"
					title="No image available"
				></span>`,
			)}`,
			() => html`<span class="as-image" inert></span>`,
		)}
		<section>
		${when(
			data?.tags,
			(tag_ids) => html`<ul>${
				tag_ids
					.map(({id}) => id)
					.filter((
						maybe,
					): maybe is keyof typeof tags => maybe in tags)
					.map((id) => html`<li>${tags[id].name}</li>`)}</ul>`,
		)}${when(
			data?.short_description,
			(description) => html`<p>${description}</p>`,
		)}
		</section>
		<footer>
			${when(
				data?.mod_reference,
				(mod_reference) => html`<a
					href="https://ficsit.app/mod/${
						encodeURIComponent(mod_reference)
					}"
					title="View ${name}"
				><span aria-hidden="true">ℹ️</span></a>`,
			)}
		</footer>`;
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
				>${when(
					this.#controller.value?.has(result.ref) ?? false,
					() => until(
						this.#fetch(result.ref),
						this.#content({
							name: '...loading',
						}),
					),
					() => this.#content({
						name: '',
					}),
				)}</div>`,
			)
		}`;
	}

	async #fetch(id: Mod['id']): Promise<TemplateResult> {
		const mod = await this.provider.getMod(id);

		return this.#content({
			name: mod.name,
			data: mod,
		});
	}

	updated(changed_properties: Map<string, unknown>) {
		super.updated(changed_properties);

		for (const item of (
			this.querySelectorAll('[data-ref]') || [])
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
