const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/simulator/js/app.js',
    output: {
      filename: 'simulator/main.js',
      path: path.resolve(__dirname, 'dist'),
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
      new HtmlWebpackPlugin({
        template: './src/simulator/index.html',
        filename: 'simulator/index.html',
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'src/img',
            to: 'img',
            noErrorOnMissing: true,
            globOptions: {
              ignore: ['**/.DS_Store']
            }
          },
          {
            from: 'manifest',
            to: 'simulator/manifest',
            noErrorOnMissing: true,
            globOptions: {
              ignore: ['**/.DS_Store']
            }
          }
        ]
      }),
    ],
    cache: {
      type: 'filesystem'
    },
    mode: isProduction ? 'production' : 'development',
    resolve: {
      alias: {
        'mathjs': path.resolve(__dirname, 'node_modules/mathjs'), // Avoid duplicated mathjs instances for tex-math-parser
      },
    },
    devServer: {
      static: './dist',
      client: {
        overlay: {
          errors: true,
          warnings: false,
        },
      },
      historyApiFallback: {
        index: 'simulator/'
      },
    },
    devtool: isProduction ? 'source-map' : 'eval-source-map',
  };
};