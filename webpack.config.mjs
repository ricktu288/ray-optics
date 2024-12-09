import path from 'path';
import fs from 'fs';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import buildInlineLocaleData from './scripts/buildInlineLocaleData.mjs';

export default (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/simulator/js/app.js',
    output: {
      filename: 'simulator/main.js',
      path: path.resolve('dist'),
      assetModuleFilename: (pathData) => {
        const filepath = path.dirname(pathData.filename).split('/').slice(1).join('/');
        return `${filepath}/[name][ext]`;
      },
    },
    module: {
      rules: [
        {
          test: /\.html$/,
          use: ['html-loader'],
        },
        {
          test: /\.(scss)$/,
          use: ['style-loader', 'css-loader', 'sass-loader'],
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'img/[name][ext]',
          },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/simulator/index.html',
        filename: 'simulator/index.html',
        templateContent: () => {
          const templateContent = fs.readFileSync('./src/simulator/index.html', 'utf-8');
          const localeData = buildInlineLocaleData();
          return templateContent.replace('{ /* LOCALE DATA */ }', JSON.stringify(localeData));
        },
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'src/img', to: 'img', noErrorOnMissing: true },
          { from: 'manifest', to: 'simulator/manifest', noErrorOnMissing: true },
          { from: 'locales', to: 'locales', noErrorOnMissing: true },
        ],
      }),
    ],
    cache: { type: 'filesystem' },
    mode: isProduction ? 'production' : 'development',
    resolve: {
      alias: {
        mathjs: path.resolve('node_modules/mathjs'),
      },
    },
    devServer: {
      static: './dist',
      client: {
        overlay: { errors: true, warnings: false },
      },
    },
    devtool: isProduction ? 'source-map' : 'eval-source-map',
  };
};
