/*
 * Copyright 2024 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import path from 'path';
import fs from 'fs';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import buildInlineLocaleData from './scripts/buildInlineLocaleData.mjs';
import { VueLoaderPlugin } from 'vue-loader';

export default (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/app/main.js',
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
          test: /\.vue$/,
          use: 'vue-loader'
        },
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
          test: /\.(png|jpe?g|gif|svg|eot|ttf|woff|woff2)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'img/[name][ext]',
          },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/app/index.html',
        filename: 'simulator/index.html',
        templateContent: () => {
          const templateContent = fs.readFileSync('./src/app/index.html', 'utf-8');
          const localeData = buildInlineLocaleData();
          return templateContent.replace('{ /* LOCALE DATA */ }', JSON.stringify(localeData));
        },
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'src/img', to: 'img', noErrorOnMissing: true },
          { from: 'src/app/manifest', to: 'simulator/manifest', noErrorOnMissing: true },
          { from: 'locales', to: 'locales', noErrorOnMissing: true },
        ],
      }),
      new VueLoaderPlugin(),
    ],
    cache: { type: 'filesystem' },
    mode: isProduction ? 'production' : 'development',
    resolve: {
      alias: {
        mathjs: path.resolve('node_modules/mathjs'),
        'vue$': 'vue/dist/vue.esm-bundler.js'
      },
      extensions: ['.js', '.vue']
    },
    devServer: {
      static: './dist',
      client: {
        overlay: { errors: true, warnings: false },
      },
      historyApiFallback: {
        rewrites: [
          { from: /^\/(?!.*\.html$).*$/, to: context => `${context.parsedUrl.pathname}.html` }
        ]
      },
    },
    devtool: isProduction ? 'source-map' : 'eval-source-map',
  };
};
