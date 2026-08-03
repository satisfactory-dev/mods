import type {
	IndexResult,
} from '@satisfactory-dev/lunr';

import {
	html,
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

import type Search from '../../search.ts';

import type {
	result as Mod,
} from '../../api/getMod.ts';

import {
	assert_non_empty,
} from '../../helper/array.ts';

import tags from '../../../.cache/api/tags.json' with {type: 'json'};

import _mod_ids from '../../../.cache/indexed-mod-ids.json';

assert_non_empty(_mod_ids);

const mod_ids = _mod_ids;

export default class Ui {
	#api_cache_root: `${string}/api/`;

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

	constructor({
		target,
		search,
		api_cache_root,
		initial_query,
	}: {
		target: HTMLElement,
		search: Search,
		api_cache_root: `${string}/api/`,
		initial_query?: string,
	}) {
		this.#target = target;
		this.#search = search;
		this.#api_cache_root = api_cache_root;
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
						() => html`<ol>${
							repeat(
								this.#debounced as IndexResult[],
								({ref}) => ref,
								(
									result,
								) => html`<li
									data-ref="${result.ref}"
									data-score="${result.score}"
								>${until(
									fetch(`${
										this.#api_cache_root
									}/getMod--reduced/${
										result.ref
									}.json`)
										.then((e) => e.json())
										.then((mod: Mod) => html`${mod.name}`),
									'...loading',
								)}</li>`)
						}</ol>`,
						() => html`<p>An error occurred!</p>`,
					),
				),
			),
		)}</output>`;
	}

	#render() {
		render(this.template, this.#target);
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
			if (!Ui.#should_run_search(target, search)) {
				return;
			}

			this.#debounced = undefined;

			clearTimeout(this.#debounce);

			this.#render();

			this.#debounce = setTimeout(() => {
				this.#debounced = true;

				const search_value = search.value.trim();

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
	}

	static #is_filter_button(maybe: unknown): maybe is HTMLButtonElement {
		return (
			(maybe instanceof HTMLButtonElement)
			&& maybe.matches('button[aria-controls="filters"')
		);
	}

	static #should_run_search(
		maybe: unknown,
		search: HTMLInputElement & {type: 'search'},
	): maybe is HTMLInputElement {
		return (
			'' !== search.value.trim()
			&& (maybe instanceof HTMLElement)
			&& (
				maybe.matches('input[type="search"]')
				|| maybe.matches('input[name="tags[]"]')
			)
		);
	}
}
