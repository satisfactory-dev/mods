import type {
	AcceptedPlugin,
} from 'postcss';

/*
node_modules/cssnano/types/index.d.ts:1:1 - error TS2309: An export assignment cannot be used in a module with other exported elements.

1 export = cssnanoPlugin;
  ~~~~~~~~~~~~~~~~~~~~~~~
*/
export {}

declare module 'cssnano' {
	export default function cssnano(args: unknown): AcceptedPlugin;
}
