import babel from 'rollup-plugin-babel';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import replace from 'rollup-plugin-replace';
import uglify from 'rollup-plugin-uglify';

export default {
  input: 'src/index.js',
  output:
    {
      file: 'lib/rxcc-es5-umd-rollup.js',
      name: 'rxcc',
      format: 'umd',
      sourcemap: true,
    },
  plugins: [
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
      babelrc: false,
      exclude: 'node_modules/**',
    }),
    replace({
      ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
    }),
    (process.env.NODE_ENV === 'production' && uglify())
  ]
}
