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

import type {
	SupportedToggles,
} from '../../search.ts';

import tags from '../../../.cache/api/tags.json' with {type: 'json'};

import _mod_ids from '../../../.cache/indexed-mod-ids.json' with {
	type: 'json',
};

import type {
	logo_size,
} from '../../../populate-cache.ts';

import logo_sizes_raw from '../../../.cache/logo-sizes.json' with {
	type: 'json',
};

const logo_sizes = new Map(Object.entries(logo_sizes_raw as unknown as {
	[k in string]: [
		logo_size,
		logo_size,
		logo_size,
	];
}));

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

	#logo_size_url(mod: Mod, size: logo_size) {
		return `./thumbnail/mod/${
			encodeURIComponent(mod.id)
		}-${
			encodeURIComponent(size[0])
		}-${
			encodeURIComponent(size[3])
		}.webp`;
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

	#mod_link(
		mod: ModContent['data'],
		content: (mod: ModContent['data']) => TemplateResult | string,
		class_map: Parameters<typeof classMap>[0] = {},
	) {
		return html`<a
			class=${classMap(class_map)},
			target="_blank"
			href="https://ficsit.app/mod/${
				encodeURIComponent(mod.mod_reference)
			}"
			title="View ${mod.name}"
		>${content(mod)}</a>`;
	}

	#content({
		name,
		data,
	}: {
		name: string,
		data?: ModContent['data'],
	}) {
		return html`<header>
			<h1>${when(
				data,
				(value) => this.#mod_link(value, (mod) => mod.name),
				() => name,
			)}</h1>
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
						<li aria-label="Controller">
						${this.#conditionally(
							'',
							data,
							'compatibility',
							({
								Controller: {
									state,
								},
							}) => html`<span
								aria-label="${state}"
								class="icon"
							>${
								(
									'Supported' === state
									|| 'Implicit' === state
								)
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
				(logo) => this.#mod_link(
					value,
					() => html`${when(
						logo_sizes.get(value.id),
						(sizes) => {
							sizes = sizes.sort(([a], [b]) => {
								return a - b;
							});

							const size = sizes[sizes.length - 1];

							// using aria-hidden due to lack of alt data in api
							return html`<img
								aria-hidden="true"
								loading="lazy"
								width="${size[1]}"
								height="${size[2]}"
								src="${this.#logo_size_url(
									value,
									size,
								)}"
								srcset="${sizes.map((size) => `${
									this.#logo_size_url(value, size)
								} ${
									size[1]
								}w`).join(', ')}"
							>`;
						},
					() => html`<img
					src="${logo}"
					width="1024"
					height="1024"
					loading="lazy"
						>`,
					)}`,
					{
						'has-image': true,
					},
				),
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
			(tag_ids) => html`<ul class="tags">${
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
				data,
				(data) => this.#mod_link(
					data,
					() => html`<span aria-hidden="true">ℹ️</span>`,
				),
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

type Toggles = (
	& {
		[k in SupportedToggles]: () => void;
	}
	& {
		it: () => void,
	}
);

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

	#invert_tags = false;

	#working_on_stable_only = true;

	#controller_supported_or_moot = false;

	#no_ai = true;

	#toggles: Toggles = {
		woso: () => {
			this.#working_on_stable_only = !this.#working_on_stable_only;
		},
		controller: () => {
			this.#controller_supported_or_moot = (
				!this.#controller_supported_or_moot
			);
		},
		noai: () => {
			this.#no_ai = !this.#no_ai;
		},
		it: () => {
			this.#invert_tags = !this.#invert_tags;
		},
	};

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
					<fieldset>
						<ul>
							<li>
								<input
									type="checkbox"
									name="woso"
									id="working-on-stable-only"
									?checked=${this.#working_on_stable_only}
								>
								<label
									for="working-on-stable-only"
								>${
									'Working on stable only'
								}</label>
							</li>
							<li>
								<input
									type="checkbox"
									name="controller"
									id="controller-supported-or-moot"
									?checked=${
										this.#controller_supported_or_moot
									}
								>
								<label
									for="controller-supported-or-moot"
								>${
									'Works with Controller (or moot)'
								}</label>
							</li>
							<li>
								<input
									type="checkbox"
									name="noai"
									id="no-ai"
									?checked=${this.#no_ai}
								>
								<label
									for="no-ai"
								>${
									'No AI'
								}</label>
							</li>
							<li>
								<input
									type="checkbox"
									name="it"
									id="invert-tags"
									?checked=${this.#invert_tags}
								>
								<label
									for="invert-tags"
								>${
									'Tag Filter excludes instead of includes'
								}</label>
							</li>
						</ul>
					</fieldset>
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
		)}</output>
		<footer>
			${Ui.#copyright_notice()}
		</footer>`;
	}

	#render() {
		render(this.template, this.#target);
	}

	#debounced_search(
		form: HTMLFormElement,
		search: string,
	) {
		const search_value = search.trim();

		this.#debounced = undefined;

		clearTimeout(this.#debounce);

		this.#render();

		this.#debounce = setTimeout(() => {
			this.#debounced = true;

			const tag_match = [...form.querySelectorAll<HTMLInputElement>(
				'input[name="tags[]"]:checked',
			)].map((e) => e.value);

			void this.#search.search(
				search_value,
				{
					tags_query_exclude: (
						this.#invert_tags ? tag_match : []
					),
					tags_query_include: (
						this.#invert_tags ? [] : tag_match
					),
					noai: this.#no_ai,
					woso: this.#working_on_stable_only,
					controller: this.#controller_supported_or_moot,
				},
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

	#is_toggle(maybe: string): maybe is keyof Toggles {
		return maybe in this.#toggles;
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
			const coerced = target as HTMLElement;

			if (
				coerced.matches(
					'input[name][type="checkbox"]:not([name="tags[]"])',
				)
			) {
				const name = (coerced as HTMLInputElement).name;

				if (this.#is_toggle(name)) {
					this.#toggles[name]();
				}
			}

			this.#debounced_search(
				form,
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
			this.#initial_query,
		);
	}

	static #is_filter_button(maybe: unknown): maybe is HTMLButtonElement {
		return (
			(maybe instanceof HTMLButtonElement)
			&& maybe.matches('button[aria-controls="filters"')
		);
	}

	static #copyright_notice() {
		const now = new Date();

		return html`
			<p>An experimental forked search alternative of <a
				target="_blank"
				href="https://ficsit.app/mods"
			>https://ficsit.app/mods</a>.</p>
			<p>Fork &copy; ${
				now.getFullYear()
			} <a
				target="_blank"
				href="https://github.com/satisfactory-dev/mods/"
			>SignpostMarv</a>, last build at ${
				now.toTimeString()
			} on ${
				now.toDateString()
			}.</p>
			<p>Original data / content managed by <a
				target="_blank"
				href="https://ficsit.app/tos"
			>ficsit.app</a>.</p>
		`;
	}
}
