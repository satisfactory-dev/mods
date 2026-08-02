import type {
	IndexResult,
} from '@satisfactory-dev/lunr';

import {
	html,
	render,
} from 'lit';

import {
	when,
} from 'lit/directives/when.js';
import {
	until,
} from 'lit/directives/until.js';

import type Search from '../../search.ts';

import type {
	result as Mod,
} from '../../api/getMod.ts';

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

	constructor(
		target: HTMLElement,
		search: Search,
		api_cache_root: `${string}/api/`,
	) {
		this.#target = target;
		this.#search = search;
		this.#api_cache_root = api_cache_root;
	}

	get template() {
		return html`<form id="search">
			<fieldset>
				<ul>
					<li>
						<input
							type="search"
							aria-label="Search query for mods"
						>
					</li>
				</ul>
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
							(this.#debounced as IndexResult[]).map((
								result,
							) => html`<li
								data-ref="${result.ref}"
								data-score="${result.score}"
							>${until(
								fetch(`${
									this.#api_cache_root
								}/getMods/${
									result.ref
								}.json`)
									.then((e) => e.json())
									.then((mod: Mod) => html`${mod.name}`),
								() => '...loading',
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
		this.#target.querySelector('form')
			?.addEventListener('input', ({target}) => {
				if (!Ui.#is_search(target)) {
					return;
				}

				this.#debounced = undefined;

				clearTimeout(this.#debounce);

				this.#render();

				this.#debounce = setTimeout(() => {
					this.#debounced = true;
					void this.#search.search(target.value)
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
	}

	static #is_search(maybe: unknown): maybe is HTMLInputElement {
		return (
			(maybe instanceof HTMLElement)
			&& maybe.matches('input[type="search"]')
		);
	}
}
