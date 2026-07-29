import type {
	ValidateFunction,
} from 'ajv';

export default <T>(
	validator: ValidateFunction<T>,
	result: unknown,
): T => {
	if (!validator(result)) {
		console.error(validator.errors);

		throw new Error('Failed to validate response!');
	}

	return result;
};
