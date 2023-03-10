import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import dev from 'rollup-plugin-dev';
import nodePolyfills from 'rollup-plugin-node-polyfills';

export default {
	inlineDynamicImports: true,
	input: 'src/engine.js',
	plugins: [
		resolve(),
		commonjs(),
		nodePolyfills(),
		dev({ host: '127.0.0.1' })
	],
	output: {
		file: 'build/engine.min.js',
		format: 'es'
	}
};
