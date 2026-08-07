import type {
	ValidateFunction,
} from 'ajv';

import type {
	result,
	schema_type,
} from '../api/getMod--reduced.ts';
import {
	get_validator,
} from '../api/getMod--reduced.ts';

import type Provider from './interface.ts';

class FetchQueue {
	#controller: AbortController;

	#results = new Map<result['id'], Promise<result>>();

	#pending = new Map<result['id'], [
		(value: result) => void,
		(failure: unknown) => void,
	]>();

	#debounced: (
		| undefined
		| ReturnType<typeof requestIdleCallback>
	) = undefined;

	#batch_size: number;

	#api_cache_root: `${string}/api/`;

	#validator: ReturnType<typeof get_validator>;

	constructor({
		batch_size,
		api_cache_root,
	}: {
		batch_size: number,
		api_cache_root: `${string}/api/`,
	}) {
		this.#controller = new AbortController();
		this.#batch_size = batch_size;
		this.#api_cache_root = api_cache_root;
		this.#validator = get_validator();
	}

	#debounce() {
		if (this.#debounced) {
			cancelIdleCallback(this.#debounced);

			let i = 0;

			const batch_size = Math.max(2, this.#batch_size);

			for (const [id, [yup, nope]] of this.#pending) {
				if (i >= batch_size) {
					break;
				}

				void Promise.all([
					this.#validator,
					fetch(
						`${this.#api_cache_root}/getMod--reduced/${id}.json`,
						{
							signal: this.#controller.signal,
						},
					).then((e) => e.json()),
				]).then(([
					validator,
					raw,
				]: [
					ValidateFunction<schema_type>,
					unknown,
				]) => {
					const maybe = {data: {getMod: raw}};

					if (!validator(maybe)) {
						console.error(validator.errors);

						nope(new Error(`JSON response for mod ${
							id
						} failed to pass validation!`));

						return;
					}

					const mod = maybe.data.getMod;

					yup(mod);

					this.#results.set(mod.id, Promise.resolve(mod));
				}).catch((err) => {
					this.#results.delete(id);

					nope(err);
				});

				this.#pending.delete(id);

				++i;
			}
		}

		this.#debounced = requestIdleCallback(() => this.#debounce());
	}

	fetch(mod: result['id']): Promise<result> {
		let existing = this.#results.get(mod);

		if (!existing) {
			existing = new Promise<result>((yup, nope) => {
				this.#pending.set(mod, [yup, nope]);
			});

			this.#results.set(mod, existing);
		}

		this.#debounce();

		return existing;
	}

	abort() {
		this.#controller.abort();
	}
}

export default class Fetch implements Provider {
	#queue: FetchQueue;

	constructor(
		api_cache_root: `${string}/api/`,
		batch_size: number,
	) {
		this.#queue = new FetchQueue({
			batch_size,
			api_cache_root,
		});
	}

	async getMod(id: result['id']): Promise<result> {
		return this.#queue.fetch(id);
	}
}
