/* global __dirname, require, module*/

const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const UglifyJsPlugin = webpack.optimize.UglifyJsPlugin;
const path = require('path');
const env = require('yargs').argv.env; // use --env with webpack 2

let libraryName = 'demo';

let outputFile;

if (env === 'build') {
  plugins.push(new UglifyJsPlugin({ minimize: true }));
  outputFile = libraryName + '.min.js';
} else {
  outputFile = libraryName + '.js';
}

const SASSLoader = {
  test: /\.scss$/,
  loader: ExtractTextPlugin.extract({
    fallbackLoader: 'style-loader',
    loader: 'css-loader?modules&importLoaders=1&localIdentName=[name]__[local]___[hash:base64:5]' +
    '!postcss-loader' +
    '!sass-loader?outputStyle=expanded'
  })
}

const CSSLoader = {
  test: /\.css$/,
  loader: ExtractTextPlugin.extract({
    fallbackLoader: 'style-loader',
    loader: 'css-loader?modules&importLoaders=1&localIdentName=[name]__[local]___[hash:base64:5]' +
    '!postcss-loader'
  }),
}

const ImageLoader = {
  test: /\.(jpe?g|png|gif|svg)$/i,
  loaders: [
    'file?hash=sha512&digest=hex&name=[hash].[ext]',
    'image-webpack?bypassOnDebug&optimizationLevel=7&interlaced=false',
  ],
}

const config = {
  entry: __dirname + '/src/index.js',
  devtool: 'source-map',
  output: {
    path: __dirname + '/lib',
    filename: outputFile,
    library: libraryName,
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  module: {
    loaders: [
      {
        test: /(\.jsx|\.js)$/,
        loader: 'babel-loader',
        exclude: /(node_modules|bower_components)/
      },
      SASSLoader,
      CSSLoader,
      ImageLoader,
    ],
  },
  resolve: {
    alias: {
      main: path.resolve(__dirname, '../../')
    },
    modules: [path.resolve('./node_modules'), path.resolve('./src'), path.resolve('./src/scss')],
    extensions: ['.json', '.js', '.scss']
  },
  plugins: [
    new ExtractTextPlugin("styles.css"),
  ]
};

module.exports = config;
