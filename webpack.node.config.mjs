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

export default (env, argv) => {

  return {
    entry: './src/core/index.js',
    target: 'node',
    output: {
      filename: 'rayOptics.js',
      libraryTarget: 'commonjs2',
      path: path.resolve('dist-node'),
      assetModuleFilename: (pathData) => {
        const filepath = path.dirname(pathData.filename).split('/').slice(1).join('/');
        return `${filepath}/[name][ext]`;
      }
    },
    module: {
      rules: [
        {
          test: /\.html$/,
          use: ['html-loader']
        },
        {
          test: /\.(scss)$/,
          use: [
            'style-loader',
            'css-loader',
            'sass-loader',
          ],
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'img/[name][ext]'
          }
        }
      ],
    },
    plugins: [
    ],
    cache: {
      type: 'filesystem'
    },
    mode: 'development',
    resolve: {
      alias: {
        mathjs: path.resolve('node_modules/mathjs'),
      },
    },
  };
};