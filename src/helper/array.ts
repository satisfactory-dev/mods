export function assert_non_empty<T>(
	value: T[],
	failure = 'Expected a non-empty array',
): asserts value is [T, ...T[]] {
	if (value.length < 1) {
		throw new Error(failure);
	}
}
