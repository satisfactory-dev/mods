import type {} from '@signpostmarv/js-types';

import type {
	IndexResult,
	SerializedIndex,
} from '@satisfactory-dev/lunr';
import {
	Index,
} from '@satisfactory-dev/lunr';

export type Commands = {
	init: {
		cmd: 'init',
		args: [string],
	},
	search: {
		cmd: 'search',
		args: [string],
	},
};

export type Results = {
	init: {
		success: 'init',
	},
	search: {
		success: 'search',
		result: [
			string,
			IndexResult[],
		],
	},
};

export type CommandError = {
	error: keyof Commands,
	message: string,
};

let index: Index|undefined = undefined;

function validator(
	maybe: unknown,
): maybe is Commands[keyof Commands] {
	if (!(
		'object' === typeof maybe
		&& null !== maybe
	)) {
		return false;
	}

	const keys = Object.keys(maybe);

	return (
		2 === keys.length
		&& 'cmd' in maybe
		&& 'args' in maybe
		&& 'string' === typeof maybe.cmd
		&& Array.isArray(maybe.args)
		&& (
			'init' === maybe.cmd
			|| 'search' === maybe.cmd
		)
		&& 1 === maybe.args.length
		&& 'string' === typeof maybe.args[0]
		&& '' !== maybe.args[0]
	);
}

self.addEventListener('message', (e) => {
	if (!validator(e.data)) {
		console.error('failure inside worker');

		postMessage(
			{error: 'unsupported command'},
		);

		return;
	}

	const {cmd, args} = e.data;

	if ('init' === cmd) {
		index = Index.load(JSON.parse(args[0]) as SerializedIndex);
		postMessage(
			{success: 'init'},
		);
	} else if ('search' === cmd) {
		if (undefined === index) {
			postMessage(
				{error: 'init', message: 'Index not initialised'},
			);
		} else {
			const result = index.search(args[0]);

			postMessage(
				{success: 'search', result: [args[0], result]},
			);
		}
	}
});
