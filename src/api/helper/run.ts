export default (operation: string, sub_query: string) => {
	return fetch(
		'https://api.ficsit.app/v2/query',
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				query: `{${operation} {
					${sub_query}
				}}`,
			}),
		},
	).then((res) => {
		return res.json();
	});
};
