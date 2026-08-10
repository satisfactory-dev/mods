import type {} from '@signpostmarv/js-types';

import Worker from 'web-worker';

import type {
	IndexResult,
} from '@satisfactory-dev/lunr';
import {
	MatchData,
} from '@satisfactory-dev/lunr';

import type {
	SchemaObject,
	ValidateFunction,
} from './helper/ajv.ts';

import type {
	CommandError,
	Commands,
	Results,
	ResultsChoice,
} from './search/thread.ts';

type Success<
	Required extends [string, ...string[]],
	Properties extends {
		[k in Required[number]]: SchemaObject;
	},
> = {
	type: 'object',
	required: Required,
	additionalProperties: false,
	properties: Properties,
};

type SuccessBasic<
	Cmd extends keyof Commands,
> = Success<['success'], {
	success: {
		type: 'string',
		const: Cmd,
	},
}>;

type SuccessWithResult<
	Cmd extends keyof Commands,
	Result extends SchemaObject,
> = Success<['success', 'result'], {
	success: {
		type: 'string',
		const: Cmd,
	},
	result: Result,
}>;

export function compile_results_schema() {
	const arg_config: [
		(
			| [keyof Commands]
			| [keyof Commands, SchemaObject]
		),
		...(
			| [keyof Commands]
			| [keyof Commands, SchemaObject]
		)[],
	] = [
		[
			'init',
		],
		[
			'search',
			{
				type: 'array',
				minItems: 2,
				maxItems: 2,
				prefixItems: [
					{
						type: 'string',
						minLength: 1,
					},
					{
						type: 'array',
						items: {
							type: 'object',
							required: ['ref', 'score', 'matchData'],
							additionalProperties: false,
							properties: {
								ref: {
									$ref: 'defs#/$defs/id',
								},
								score: {
									type: 'number',
									minimum: 0,
								},
								matchData: {
									type: 'object',
								},
							},
						},
					},
				],
			},
		],
	];

	const args = arg_config.map(<
		Cmd extends keyof Commands,
		Result extends SchemaObject,
		Item extends (
			| [Cmd]
			| [Cmd, Result]
		),
	>(
		[
			cmd,
			result,
		]: (
			Item
		),
	) => {
		const schema: (
			| SuccessBasic<Cmd>
			| SuccessWithResult<Cmd, Result>
		) = {
			type: 'object',
			required: ['success'],
			additionalProperties: false,
			properties: {
				success: {
					type: 'string',
					const: cmd,
				},
			},
		};

		if (undefined !== result) {
			return {
				...schema,
				required: ['success', 'result'] as const,
				properties: {
					...schema.properties,
					result,
				},
			};
		}

		return schema;
	});

	return {
		$id: 'search-results',
		oneOf: [
			...args,
			{
				type: 'object',
				required: ['error', 'message'],
				additionalProperties: false,
				properties: {
					error: {
						type: 'string',
						enum: args.map((e) => e.properties.success),
					},
					message: {
						type: 'string',
						minLength: 1,
					},
				},
			},
		],
	};
}

async function get_results_validator() {
	return import(
		'../.cache/search.validator.ts',
	).then(({
		validator_search_results,
	}) => validator_search_results as ValidateFunction<ResultsChoice>);
}

class SearchWorker {
	#init_with: string;

	#worker: Worker;

	#ready = false;

	#ready_promise: Promise<void> | undefined;

	constructor(
		init_with: string,
		source = new URL('./search/thread.ts', import.meta.url),
	) {
		this.#init_with = init_with;

		this.#worker = new Worker(
			source,
			{
				type: 'module',
			},
		);
	}

	get ready() {
		return this.#get_ready();
	}

	async #get_ready() {
		if (this.#ready) {
			return Promise.resolve();
		} else if (!this.#ready_promise) {
			let init: (((e: MessageEvent) => void) | undefined);
			let init_err: (((e: ErrorEvent) => void) | undefined);

			const validator = await get_results_validator();

			const init_err_generator = (
				nope: (e: Error) => void,
			) => ((e: ErrorEvent) => {
				console.error(e);

				nope(new Error('Message failure!'));
			});

			const init_generator = ([
				yup,
				nope,
			]: [
				() => void,
				(err: Error) => void,
			]) => {
				const cleanup = () => {
					if (init) {
						this.#worker.removeEventListener(
							'message',
							init as EventListenerOrEventListenerObject,
						);
					}

					if (init_err) {
						this.#worker.removeEventListener(
							'error',
							init_err as EventListenerOrEventListenerObject,
						);
					}
				};

				return (e: MessageEvent) => {
					cleanup();

					let error: Error | undefined = undefined;

					const data: unknown = e.data;

					if (!SearchWorker.is_expected(data, validator)) {
						console.error(validator.errors);
						error = Error('Unsupported message!');

						if (this.#ready) {
							throw error;
						}

						nope(error);

						return;
					}

					if (SearchWorker.is_error(data)) {
						error = Error(`Error with command ${
							data.error
						}: ${
							data.message
						}`);

						if (this.#ready) {
							throw error;
						}

						nope(error);

						return;
					} else if ('init' !== data.success) {
						error = Error(
							'Receieved other success message before ready!',
						);

						if (this.#ready) {
							throw error;
						}

						nope(error);

						return;
					}

					if (this.#ready) {
						throw new Error('Already initialised!');
					}

					this.#init_with = '';
					this.#ready = true;

					yup();
				};
			};

			this.#ready_promise = new Promise((yup, nope) => {
				init = init_generator([yup, nope]);
				init_err = init_err_generator(nope);

				this.#worker.addEventListener(
					'message',
					init as EventListenerOrEventListenerObject,
				);
				this.#worker.addEventListener(
					'error',
					init_err as EventListenerOrEventListenerObject,
				);
				this.#worker.postMessage({
					cmd: 'init',
					args: [this.#init_with],
				});
			});
		}

		return this.#ready_promise;
	}

	async search(query: string): Promise<IndexResult[]> {
		const validator = await get_results_validator();

		return this.ready.then(() => new Promise((yup, nope) => {
			let handle: ((e: MessageEvent) => void) | undefined = undefined;
			let fail: ((e: ErrorEvent) => void) | undefined = undefined;

			const cleanup = () => {
				if (handle) {
					this.#worker.removeEventListener(
						'message',
						handle as EventListenerOrEventListenerObject,
					);
				}

				if (fail) {
					this.#worker.removeEventListener(
						'error',
						fail as EventListenerOrEventListenerObject,
					);
				}
			};

			handle = ({data}: MessageEvent) => {
				if (!SearchWorker.is_expected(data, validator)) {
					cleanup();

					nope(new Error('Unsupported message'));

					return;
				} else if (SearchWorker.is_error(data)) {
					cleanup();

					nope(new Error(`Error with command ${
						data.error
					}: ${
						data.message
					}`));

					return;
				} else if (
					'search' !== data.success
					|| data.result[0] !== query
				) {
					return;
				}

				cleanup();

				yup(data.result[1]);
			};

			fail = (e: ErrorEvent) => {
				console.error(e);

				cleanup();

				nope(new Error('Message failure!'));
			};

			this.#worker.addEventListener(
				'message',
				handle as EventListenerOrEventListenerObject,
			);
			this.#worker.addEventListener(
				'error',
				fail as EventListenerOrEventListenerObject,
			);

			this.#worker.postMessage({
				cmd: 'search',
				args: [query],
			});
		}));
	}

	static is_error(
		value: (
			| Results[keyof Results]
			| CommandError
		),
	): value is CommandError {
		return 'error' in value;
	}

	static is_success(
		value: (
			| Results[keyof Results]
			| CommandError
		),
	): value is Results[keyof Results] {
		return !this.is_error(value);
	}

	static is_expected(
		value: unknown,
		validator: ValidateFunction<ResultsChoice>,
	) {
		return validator(value);
	}
}

export type TagIndex = {
	tag_id: string,
	mods: [string, ...string[]],
};

export function get_tags_index_validator() {
	return import(
		'../.cache/search.validator.ts',
	).then(({validator_tag_index}) => validator_tag_index);
}

export type SupportedToggles = (
	| 'woso' // working on stable only
	| 'controller' // controller supported or moot
	| 'noai' // because reasons
	| 'brokensource' // broken with source linked
);

export type TogglesProviders = {
	[key in SupportedToggles]: Promise<Set<string>>;
};

export default class Search {
	#indices: Promise<[SearchWorker, ...SearchWorker[]]>;

	#tags: Promise<TagIndex[]>;

	#toggles_providers: TogglesProviders;

	#results = new Map<string, Promise<IndexResult[]>>();

	constructor(
		index_provider: Promise<[string, ...string[]]>,
		tags_provider: Promise<TagIndex[]>,
		toggles_providers: TogglesProviders,
		worker_source?: URL,
	) {
		this.#indices = index_provider.then((e) => {
			return e.map((index) => {
				return new SearchWorker(index, worker_source);
			});
		});
		this.#tags = tags_provider;
		this.#toggles_providers = toggles_providers;
	}

	async search(
		query: string,
		{
			tags_query_include = [],
			tags_query_exclude = [],
			noai = false,
			woso = false,
			controller = false,
			brokensource = false,
		}: (
			& {
				tags_query_include: string[],
				tags_query_exclude: string[],
			}
			& {
				[k in SupportedToggles]?: boolean;
			}
		),
		override_results?: [string, ...string[]],
	) {
		let results_promise = (
			override_results
				? Promise.resolve(override_results.map((ref): IndexResult => ({
					ref,
					score: 1,
					matchData: new MatchData(),
				})))
				: this.#search_query_cached(query)
		);

		if (tags_query_include.length) {
			const [
				results,
				tags,
			] = await Promise.all([
				results_promise,
				this.#tags,
			]);

			const mods_matching_tags = new Set(tags
				.filter(({
					tag_id,
				}) => tags_query_include.includes(tag_id))
				.flatMap(({mods}) => mods));

			results_promise = Promise.resolve(results.filter(({
				ref: id,
			}) => mods_matching_tags.has(id)));
		}

		if (tags_query_exclude.length) {
			const [
				results,
				tags,
			] = await Promise.all([
				results_promise,
				this.#tags,
			]);

			const mods_matching_tags = new Set(tags
				.filter(({
					tag_id,
				}) => !tags_query_exclude.includes(tag_id))
				.flatMap(({mods}) => mods));

			results_promise = Promise.resolve(results.filter(({
				ref: id,
			}) => mods_matching_tags.has(id)));
		}

		if (noai) {
			results_promise = Promise.all([
				results_promise,
				this.#toggles_providers.noai,
			]).then(([results, has_ai]) => results.filter((
				{ref: maybe},
			) => !has_ai.has(maybe)));
		}

		if (woso) {
			results_promise = Promise.all([
				results_promise,
				this.#toggles_providers.woso,
			]).then(([results, works_on_stable]) => results.filter((
				{ref: maybe},
			) => works_on_stable.has(maybe)));
		} else if (brokensource) {
			results_promise = Promise.all([
				results_promise,
				this.#toggles_providers.brokensource,
			]).then(([results, broken_with_source_linked]) => results.filter((
				{ref: maybe},
			) => broken_with_source_linked.has(maybe)));
		}

		if (controller) {
			results_promise = Promise.all([
				results_promise,
				this.#toggles_providers.controller,
			]).then(([results, works_on_controller]) => results.filter((
				{ref: maybe},
			) => works_on_controller.has(maybe)));
		}

		return results_promise;
	}

	#search_query_cached(query: string) {
		let existing = this.#results.get(query);

		if (!existing) {
			if (this.#results.size >= 10) {
				this.#results.delete([...this.#results.keys()][0]);
			}

			existing = this.#search_query_only(query);

			this.#results.set(query, existing);
		}

		return existing;
	}

	async #search_query_only(query: string) {
		return (await Promise.all(
			(
				await this.#indices
			).map((e) => e.search(query)))
		)
			.flatMap((e) => e)
			.sort((a, b) => b.score - a.score);
	}
}
