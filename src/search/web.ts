import {
	assert_non_empty,
} from '../helper/array.ts';

import type {
	TagIndex,
} from '../search.ts';
import Search, {
	get_tags_index_validator,
} from '../search.ts';

export type source = `${string}/${(
	| 'lunr'
	| 'tags'
)}.${string}.json`;

export default class Web {
	#search: Search | undefined = undefined;

	#sources: source[];

	#thread_source: URL | undefined;

	constructor(
		sources: source[],
		thread?: URL,
	) {
		this.#sources = sources;
		this.#thread_source = thread;
	}

	get search() {
		if (!this.#search) {
			this.#search = new Search(
				this.#lunr(),
				this.#tags(),
				{
					noai: this.#noai(),
					woso: this.#woso(),
					controller: this.#controller(),
				},
				this.#thread_source,
			);
		}

		return this.#search;
	}

	#lunr(): Promise<[string, ...string[]]> {
		const indices: Promise<string>[] = [];

		for (const source of this.#sources.filter((
			maybe,
		) => /lunr\..+\.json$/.test(maybe))) {
			indices.push(fetch(source).then((e) => e.text()));
		}

		assert_non_empty(indices);

		return Promise.all(indices);
	}

	async #tags(): Promise<TagIndex[]> {
		const indices: Promise<TagIndex>[] = [];

		const tags_index_validator = await get_tags_index_validator();

		for (const source of this.#sources.filter((
			maybe,
		) => /tags\..+\.json$/.test(maybe))) {
			indices.push(fetch(source)
				.then((e) => e.json())
				.then((maybe) => {
					if (!tags_index_validator(maybe)) {
						throw new Error(`Invalid tag index at ${source}`);
					}

					return maybe;
				}),
			);
		}

		assert_non_empty(indices);

		return Promise.all(indices);
	}

	static #is_ids(maybe: unknown): maybe is string[] {
		return (
			Array.isArray(maybe)
			&& maybe.every((possibly) => (
				'string' === typeof possibly
				&& /^[A-Za-z0-9]+$/.test(possibly)
			))
		);
	}

	async #noai(): Promise<Set<string>> {
		let ids = new Set<string>();

		for (const source of this.#sources.filter((
			maybe,
		) => /ai\.mod-ids\..+\.json$/.test(maybe))) {
			ids = new Set([
				...ids,
				...(await fetch(source)
					.then((e) => e.json())
					.then((maybe): string[] => {
						if (!Web.#is_ids(maybe)) {
							throw new Error(

								// oxlint-disable-next-line @stylistic/max-len
								'No-ai json contained something other than a string array!',
							);
						}

						return maybe;
					})),
			]);
		}

		return ids;
	}

	async #woso(): Promise<Set<string>> {
		let ids = new Set<string>();

		for (const source of this.#sources.filter((
			maybe,
		) => /stable\.mod-ids\..+\.json$/.test(maybe))) {
			ids = new Set([
				...ids,
				...(await fetch(source)
					.then((e) => e.json())
					.then((maybe): string[] => {
						if (!Web.#is_ids(maybe)) {
							throw new Error(

								// oxlint-disable-next-line @stylistic/max-len
								'Stable mods json contained something other than a string array!',
							);
						}

						return maybe;
					})),
			]);
		}

		return ids;
	}

	async #controller(): Promise<Set<string>> {
		let ids = new Set<string>();

		for (const source of this.#sources.filter((
			maybe,
		) => /controller-supported-or-moot\.mod-ids\..+\.json$/.test(maybe))) {
			ids = new Set([
				...ids,
				...(await fetch(source)
					.then((e) => e.json())
					.then((maybe): string[] => {
						if (!Web.#is_ids(maybe)) {
							throw new Error(

								// oxlint-disable-next-line @stylistic/max-len
								'Supports controller json contained something other than a string array!',
							);
						}

						return maybe;
					})),
			]);
		}

		return ids;
	}

	static is_source(
		maybe: string,
	): maybe is source {
		return /\/(lunr|tags)\..+\.json$/.test(maybe);
	}

	static is_mod_ids_list(
		maybe: string,
	): maybe is `/${string}.mod-ids.${string}.json` {
		return /\/.+\.mod-ids\.[a-f0-9]{8}\.json$/.test(maybe);
	}
}
