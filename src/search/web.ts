import {
	assert_non_empty,
} from '../helper/array.ts';

import type {
	TagIndex,
} from '../search.ts';
import Search, {
	tags_index_validator,
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

	#tags(): Promise<TagIndex[]> {
		const indices: Promise<TagIndex>[] = [];

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

	static is_source(
		maybe: string,
	): maybe is source {
		return /\/(lunr|tags)\..+\.json$/.test(maybe);
	}
}
