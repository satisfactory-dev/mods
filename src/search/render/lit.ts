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

import type {
	Compatibility,
	ControllerCompatibility,
} from '../../api/getMod.ts';

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
		any_compat: () => void,
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

	#search_toggles: Omit<
		Parameters<Search['search']>[1],
		(
			| 'tags'
		)
	> = {
		compatibility: {
			EA: {
				Works: true,
				Damaged: false,
				Broken: false,
			},
			EXP: {
				Works: undefined,
				Damaged: undefined,
				Broken: undefined,
			},
			Controller: {
				Untested: undefined,
				Unsupported: undefined,
				Partial: undefined,
				Implicit: undefined,
				Supported: undefined,
			},
		},
		has_ai: false,
		has_source_linked: undefined,
	};

	#preset_check: {
		[k in keyof Toggles]: () => boolean;
	} = {
		woso: () => (
			true === this.#search_toggles.compatibility.EA.Works
			&& false === this.#search_toggles.compatibility.EA.Broken
			&& false === this.#search_toggles.compatibility.EA.Damaged
			&& undefined === this.#search_toggles.compatibility.EXP.Works
			&& undefined === this.#search_toggles.compatibility.EXP.Broken
			&& undefined === this.#search_toggles.compatibility.EXP.Damaged
		),
		controller: () => {
			const checking = this.#search_toggles.compatibility.Controller;

			return (
				false === checking.Untested
				&& false === checking.Unsupported
				&& false === checking.Partial
				&& true === checking.Implicit
				&& true === checking.Supported
			);
		},
		noai: () => false === this.#search_toggles.has_ai,
		brokensource: () => (
			false === this.#search_toggles.compatibility.EA.Works
			&& true === this.#search_toggles.compatibility.EA.Broken
			&& true === this.#search_toggles.compatibility.EA.Damaged
			&& false === this.#search_toggles.compatibility.EXP.Works
			&& true === this.#search_toggles.compatibility.EXP.Broken
			&& true === this.#search_toggles.compatibility.EXP.Damaged
			&& true === this.#search_toggles.has_source_linked
		),
		any_compat: () => (
			undefined === this.#search_toggles.compatibility.EA.Works
			&& undefined === this.#search_toggles.compatibility.EA.Broken
			&& undefined === this.#search_toggles.compatibility.EA.Damaged
			&& undefined === this.#search_toggles.compatibility.EXP.Works
			&& undefined === this.#search_toggles.compatibility.EXP.Broken
			&& undefined === this.#search_toggles.compatibility.EXP.Damaged
		),
	};

	#presets: Toggles = {
		woso: () => {
			this.#search_toggles.compatibility.EA = {
				Works: true,
				Broken: false,
				Damaged: false,
			};
			this.#search_toggles.compatibility.EXP = {
				Works: undefined,
				Broken: undefined,
				Damaged: undefined,
			};
		},
		controller: () => {
			this.#search_toggles.compatibility.Controller = {
				Untested: false,
				Unsupported: false,
				Partial: false,
				Implicit: true,
				Supported: true,
			};
		},
		noai: () => {
			this.#search_toggles.has_ai = false;
		},
		brokensource: () => {
			this.#search_toggles.compatibility.EA = {
				Works: false,
				Broken: true,
				Damaged: true,
			};
			this.#search_toggles.compatibility.EXP = {
				Works: false,
				Broken: true,
				Damaged: true,
			};
			this.#search_toggles.has_source_linked = true;
		},
		any_compat: () => {
			this.#search_toggles.compatibility.EA = {
				Works: undefined,
				Broken: undefined,
				Damaged: undefined,
			};
			this.#search_toggles.compatibility.EXP = {
				Works: undefined,
				Broken: undefined,
				Damaged: undefined,
			};
		},
	};

	#copyright_notice: DocumentFragment;

	#tag_status = new Map<string, 0|1|2>();

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

		const copyright_notice = (
			document.querySelector(
				'template#copyright-notice',
			) as unknown as HTMLTemplateElement | null
		)?.content;

		if (!copyright_notice) {
			throw new Error('Could not find copyright notice!');
		}

		this.#copyright_notice = document.importNode(copyright_notice, true);
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
						<legend>Filter Presets</legend>
						<ul>${([
							['woso', 'Working on stable only'],
							['controller', 'Works with Controller (or moot)'],
							['noai', 'No AI'],
							['brokensource', 'Broken, source linked'],
							['any_compat', 'Ignore compatibility'],
						] as const).map(([preset, label]) => html`<li>${
							this.#preset_button(preset, label)
						}</li>`)}</ul>
					</fieldset>
					<fieldset>
						<legend>Branch Compatibility</legend>
						<fieldset>
							<legend>EA / Stable</legend>
							<ul>
								<li>${this.#search_toggle_branch_button(
									'EA',
									'Works',
								)}</li>
								<li>${this.#search_toggle_branch_button(
									'EA',
									'Damaged',
								)}</li>
								<li>${this.#search_toggle_branch_button(
									'EA',
									'Broken',
								)}</li>
							</ul>
						</fieldset>
						<fieldset>
							<legend>EXP</legend>
							<ul>
								<li>${this.#search_toggle_branch_button(
									'EXP',
									'Works',
								)}</li>
								<li>${this.#search_toggle_branch_button(
									'EXP',
									'Damaged',
								)}</li>
								<li>${this.#search_toggle_branch_button(
									'EXP',
									'Broken',
								)}</li>
							</ul>
						</fieldset>
						<fieldset>
							<legend>Controller</legend>
							<ul>
								<li>${this.#search_toggle_controller_button(
									'Supported',
								)}</li>
								<li>${this.#search_toggle_controller_button(
									'Implicit',
								)}</li>
								<li>${this.#search_toggle_controller_button(
									'Partial',
								)}</li>
								<li>${this.#search_toggle_controller_button(
									'Untested',
								)}</li>
								<li>${this.#search_toggle_controller_button(
									'Unsupported',
								)}</li>
							</ul>
						</fieldset>
					</fieldset>
					<fieldset>
						<legend>Additional Filters</legend>
						<ul>
							<li>${this.#search_toggle_has_button(
								'has-ai',
								'Mod uses AI',
								'AI',

								// oxlint-disable-next-line @stylistic/max-len
								'Mod author has disclosed that AI is used at runtime or during the development of the mod.',
							)}</li>
							<li>${this.#search_toggle_has_button(
								'has-source-linked',
								'Mod has source linked',
								'Source 🔗',

								// oxlint-disable-next-line @stylistic/max-len
								'Mod has a link to source listed in the mod page on ficsit.app',
							)}</li>
						</ul>
					</fieldset>
					<fieldset>
							<legend>Tags</legend>
					<ul
						id="tags"
					>${repeat(Object.entries(tags), ([id]) => id, ([
						id,
						{
							name,
							description,
						},
					]) => html`<li>
						<button
							type="button"
							name="tags[]"
							value="${id}"
							role="checkbox"
							aria-checked="${
								[
									'mixed',
									'true',
									'false',
								][this.#tag_status.get(id) || 0]
							}"
							aria-label="${
								`${
									name
								}, ${
									[
										'ignored by filter',
										'required by filter',
										'excluded by filter',
									][this.#tag_status.get(id) || 0]
								}`
							}"
							aria-describedby="tag-tooltip-${id}"
						>
							<span
								id="tag-name-${id}"
								inert
								aria-hidden="true"
							>${name}</span>
						<aside
							id="tag-tooltip-${id}"
							role="tooltip"
						>${description}</aside>
						</button>
					</li>`)}</ul>
					</fieldset>
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
			${this.#copyright_notice}
		</footer>`;
	}

	#search_toggle_button(
		search_toggle: string,
		value_as_integer: 0|1|2,
		label: string,
		text: string,
		title?: string,
	): TemplateResult {
		return html`<button
			type="button"
			data-action="search-toggle"
			data-search-toggle="${search_toggle}"
			role="checkbox"
			aria-checked="${
				[
					'mixed',
					'true',
					'false',
				][value_as_integer]
			}"
			aria-label="${
				label
			}, ${
				[
					'ignored by filter',
					'required by filter',
					'excluded by filter',
				][value_as_integer]
			}"
			title="${title}"
		>${text}</button>`;
	}

	#search_toggle_branch_button(
		branch: 'EA' | 'EXP',
		state: Compatibility['state'],
	) {
		const value = this.#search_toggles.compatibility[branch][state];

		const value_as_integer = (
			undefined === value
				? 0
				: (value ? 1 : 2)
		);

		return this.#search_toggle_button(
			`compat-${branch}-${state}`,
			value_as_integer,
			`${branch} compatibility status "${state}"`,
			state,
		);
	}

	#search_toggle_controller_button(
		state: ControllerCompatibility['state'],
	) {
		const value = this.#search_toggles.compatibility.Controller[state];

		const value_as_integer = (
			undefined === value
				? 0
				: (value ? 1 : 2)
		);

		return this.#search_toggle_button(
			`compat-Controller-${state}`,
			value_as_integer,
			`Controller compatibility status "${state}"`,
			state,
		);
	}

	#search_toggle_has_button(
		thing: `has-${'ai'|'source-linked'}`,
		label: string,
		text: string,
		title: string,
	) {
		const property = (
			'has-ai' === thing
				? 'has_ai'
				: 'has_source_linked'
		);

		const value = this.#search_toggles[property];

		const value_as_integer = (
			undefined === value
				? 0
				: (value ? 1 : 2)
		);

		return this.#search_toggle_button(
			thing,
			value_as_integer,
			label,
			text,
			title,
		);
	}

	#preset_button(
		preset: keyof Toggles,
		label: string,
	) {
		const active = this.#preset_check[preset]();

		return html`<button
			type="button"
			name="preset"
			value="${preset}"
			role="checkbox"
			aria-checked="${
				active
					? 'true'
					: 'false'
			}"
			aria-label="${
				label
			}, ${
				active
					? ' applied'
					: ' not applied'
			} to filter"
		>${label}</button>`;
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

			const tags_query_include: string[] = [];
			const tags_query_exclude: string[] = [];

			for (const [tag, status] of this.#tag_status) {
				if (1 === status) {
					tags_query_include.push(tag);
				} else if (2 === status) {
					tags_query_exclude.push(tag);
				}
			}

			void this.#search.search(
				search_value,
				{
					...this.#search_toggles,
					tags: {
						include: tags_query_include,
						exclude: tags_query_exclude,
					},
				},
				'' === search_value ? mod_ids : undefined,
			)
				.then(
					(results) => {
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
			const coerced = target as HTMLElement;

			if (
				coerced.matches('input[name="preset"][type="radio"]')
			) {
				const input = coerced as HTMLInputElement;

				if (this.#is_search_preset(input.value)) {
					this.#presets[input.value]();
				}
			}

			this.#debounced_search(
				form,
				search.value,
			);
		});

		form.addEventListener('click', (e) => {
			if (Ui.#is_tag_toggle(e.target)) {
				const status = (
					Math.max(0, Math.min(2, (
						this.#tag_status.get(e.target.value)
						|| 0
					)))
					+ 1
				) % 3 as 0|1|2;

				this.#tag_status.set(
					e.target.value,
					status,
				);
				this.#render();

				this.#debounced_search(
					form,
					search.value,
				);

				return;
			} else if (this.#is_preset_toggle(e.target)) {
				this.#presets[e.target.value]();
				this.#render();
				this.#debounced_search(
					form,
					search.value,
				);

				return;
			}

			const maybe_search_toggle = Ui.#maybe_search_toggle(e.target);

			if (maybe_search_toggle) {
				maybe_search_toggle(this);

				this.#render();

				this.#debounced_search(form, search.value);

				return;
			}

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

	static #is_tag_toggle(maybe: unknown): maybe is (
		& HTMLButtonElement
		& {
			name: 'tags[]',
		}
	) {
		return (
			(maybe instanceof HTMLButtonElement)
			&& maybe.matches('button[name="tags[]"]')
		);
	}

	static #is_search_toggle(
		maybe: unknown,
	): maybe is (
		HTMLButtonElement
		& {
			dataset: (
				& DOMStringMap
				& {
					action: 'search-toggle',
					searchToggle: string,
				}
			),
		}
	) {
		return (
			(maybe instanceof HTMLButtonElement)
			&& maybe.matches(
				'button[data-action="search-toggle"][data-search-toggle]',
			)
		);
	}

	static #is_branch_compat(
		maybe: string,
	): maybe is `compat-${'EA'|'EXP'}-${Compatibility['state']}` {
		return /^compat-(EA|EXP)-(Works|Damaged|Broken)$/.test(maybe);
	}

	static #is_controller_compat(
		maybe: string,
	): maybe is `compat-Controller-${ControllerCompatibility['state']}` {
		// oxlint-disable-next-line @stylistic/max-len
		return /^compat-Controller-(Untested|Unsupported|Partial|Implicit|Supported)$/.test(maybe);
	}

	static #maybe_search_toggle(maybe: unknown): (
		| undefined
		| ((ui: Ui) => void)
	) {
		if (!this.#is_search_toggle(maybe)) {
			return undefined;
		}

		if (this.#is_branch_compat(maybe.dataset.searchToggle)) {
			const [
				,
				branch,
				status,
			] = maybe.dataset.searchToggle.split('-') as [
				'compat',
				'EA' | 'EXP',
				Compatibility['state'],
			];

			return (ui: Ui) => {
				const current = ui.#search_toggles.compatibility[
					branch
				][
					status
				];

				if (undefined === current) {
					ui.#search_toggles.compatibility[branch][status] = true;
				} else if (true === current) {
					ui.#search_toggles.compatibility[branch][status] = false;
				} else {
					ui.#search_toggles.compatibility[
						branch
					][
						status
					] = undefined;
				}
			};
		} else if (this.#is_controller_compat(maybe.dataset.searchToggle)) {
			const [,, status] = maybe.dataset.searchToggle.split('-') as [
				'compat',
				'Controller',
				ControllerCompatibility['state'],
			];

			return (ui: Ui) => {
				const current = ui.#search_toggles.compatibility.Controller[
					status
				];

				if (undefined === current) {
					ui.#search_toggles.compatibility.Controller[status] = true;
				} else if (true === current) {
					ui.#search_toggles.compatibility.Controller[
						status
					] = false;
				} else {
					ui.#search_toggles.compatibility.Controller[
						status
					] = undefined;
				}
			};
		} else if ('has-ai' === maybe.dataset.searchToggle) {
			return (ui: Ui) => {
				const current = ui.#search_toggles.has_ai;

				if (undefined === current) {
					ui.#search_toggles.has_ai = true;
				} else if (true === current) {
					ui.#search_toggles.has_ai = false;
				} else {
					ui.#search_toggles.has_ai = undefined;
				}
			};
		} else if ('has-source-linked' === maybe.dataset.searchToggle) {
			return (ui: Ui) => {
				const current = ui.#search_toggles.has_source_linked;

				if (undefined === current) {
					ui.#search_toggles.has_source_linked = true;
				} else if (true === current) {
					ui.#search_toggles.has_source_linked = false;
				} else {
					ui.#search_toggles.has_source_linked = undefined;
				}
			};
		}

		return undefined;
	}

	#is_search_preset(maybe: string): maybe is keyof Toggles {
		return maybe in this.#presets;
	}

	#is_preset_toggle(maybe: unknown): maybe is (
		& HTMLButtonElement
		& {
			name: 'preset',
			value: keyof Toggles,
		}
	) {
		return (
			(maybe instanceof HTMLButtonElement)
			&& 'preset' === maybe.name
			&& this.#is_search_preset(maybe.value)
		);
	}
}
