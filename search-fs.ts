import Search from './src/search.ts';
import {
	lunr,
	tags,
	toggles_providers,
} from './src/search/fs.ts';

let [,, ...query] = process.argv;

const search = new Search(
	lunr(),
	tags(),
	toggles_providers,
);

const tags_query_include = query
	.filter((e) => e.startsWith('tag:'))
	.map((e) => e.substring(4));

const tags_query_exclude = query
	.filter((e) => e.startsWith('-tag:'))
	.map((e) => e.substring(5));

query = query
	.filter((e) => !e.startsWith('tag:'))
	.filter((e) => !e.startsWith('-tag'));

void search.search(
	query.join(' '),
	{
		tags: {
			include: tags_query_include,
			exclude: tags_query_exclude,
		},
		has_ai: undefined,
		has_source_linked: undefined,
		compatibility: {
			EA: {
				Works: undefined,
				Damaged: undefined,
				Broken: undefined,
			},
			EXP: {
				Works: undefined,
				Damaged: undefined,
				Broken: undefined,
			},
			Controller: {
				Untested: undefined,
				Unsupported: undefined,
				Partial: undefined,
				Implicit: undefined,
				Supported: undefined,
			},
		},
	},
)
	.then((yup) => {
		console.log(yup);

		process.exit(0);
	})
	.catch((err) => {
		console.error(err);

		process.exit(1);
	});
