export default (operation: string, sub_query: string): Promise<unknown> => {
	const body = {
		query: `{${operation} {
			${sub_query}
		}}`,
	};

	return fetch(
		'https://api.ficsit.app/v2/query',
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		},
	).then((res) => {
		return res.json();
	});
};
