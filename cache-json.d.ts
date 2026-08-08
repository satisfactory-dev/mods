import type {
	logo_size,
} from './populate-cache.ts';

declare module '*/.cache/api/tags.json' {
	const tags: Record<string, {
		name: string,
		description: string,
	}>;

	export default tags;
}

declare module '*/.cache/indexed-mod-ids.json' {
	const ids: string[];

	export default ids;
}

declare module '*/.cache/logo-sizes.json' {
	const sizes: Record<string, [
		logo_size,
		logo_size,
		logo_size
	]>;

	export default sizes;
}
