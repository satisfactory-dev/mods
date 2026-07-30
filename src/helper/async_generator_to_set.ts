
export async function async_generator_to_set(
	generator: AsyncGenerator<Exclude<string, ''>>,
): Promise<Set<Exclude<string, ''>>> {
	const result = new Set<Exclude<string, ''>>();

	for await (const value of generator) {
		result.add(value);
	}

	return result;
}
