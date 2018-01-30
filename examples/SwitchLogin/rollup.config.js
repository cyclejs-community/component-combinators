import babel from 'rollup-plugin-babel';
import babelrc from 'babelrc-rollup';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import replace from 'rollup-plugin-replace';
import uglify from 'rollup-plugin-uglify';

export default {
  input: 'src/index.js',
  output:
    {
      file: 'lib/rxcc-switch-demo-es5-umd-rollup.js',
      name: 'rxccSwitchDemo',
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
      namedExports: {
        // NOTE : added after reading:
        // https://github.com/rollup/rollup-plugin-commonjs#custom-named-exports
        // https://github.com/rollup/rollup/wiki/Troubleshooting#name-is-not-exported-by-module
        // https://github.com/rollup/rollup-plugin-commonjs/issues/206
        // left-hand side can be an absolute path, a path
        // relative to the current directory, or the name
        // of a module in node_modules
//        '../../utils/helpers/node_modules/rx/dist/rx.all.js': [ 'def'+'ault' ]
      },
    }),
    babel({
      babelrc: false,
      // cf. https://github.com/rollup/rollup-plugin-babel#modules
      modules: false,
      exclude: 'node_modules/**',
    }),
    replace({
      ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
    }),
    (process.env.NODE_ENV === 'production' && uglify())
  ]
}
