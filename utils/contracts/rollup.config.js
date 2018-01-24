import babel from 'rollup-plugin-babel';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import replace from 'rollup-plugin-replace';
import uglify from 'rollup-plugin-uglify';

export default {
  input: 'src/index.js',
  output:
    {
      file: 'lib/rxcc-contracts-es5-umd-rollup.js',
      name: 'rxccContracts',
      format: 'umd',
      sourcemap: true,
    },
  plugins: [
// fails with Error: Cannot split a chunk that has already been edited : Rx.Observable
    resolve({
      module: true,
      jsnext: true,
      main: true,
      browser: true,
//      modulesOnly: true,
    }),
    commonjs({
      include: 'node_modules/**',
    }),
    babel({
      exclude: 'node_modules/**',
    }),
    replace({
      ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
    }),
    (process.env.NODE_ENV === 'production' && uglify())
  ]
}
