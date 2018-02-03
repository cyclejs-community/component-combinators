import babel from 'rollup-plugin-babel';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import replace from 'rollup-plugin-replace';
import uglify from 'rollup-plugin-uglify';

export default {
  input: 'src/index.js',
  output:
    {
      file: 'lib/rxcc-drivers-es5-umd-rollup.js',
      name: 'rxccDrivers',
      format: 'umd',
      sourcemap: true,
    },
  plugins: [
    ["transform-es2015-modules-commonjs", {
      "allowTopLevelThis": true
    }],
    resolve({
      module: true,
      jsnext: true,
      main: true,
      browser: true,
      modulesOnly: true,
    }),
    commonjs({
      namedExports : {
        '../utils/debug/src/index.js': ['toHTML']
      },
      include: 'node_modules/**',
    }),
    babel({
      babelrc: false,
      // cf. https://github.com/rollup/rollup-plugin-babel#modules
//      modules: false, // that was babel <=5
      exclude: 'node_modules/**',
    }),
    replace({
      ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
    }),
    (process.env.NODE_ENV === 'production' && uglify())
  ]
}
