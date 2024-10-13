const path = require('path');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/simulator-node/main.js',
    target: 'node',
    output: {
      filename: 'main.js',
      libraryTarget: 'commonjs2',
      path: path.resolve(__dirname, 'dist-node'),
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
        'mathjs': path.resolve(__dirname, 'node_modules/mathjs'), // Avoid duplicated mathjs instances for tex-math-parser
      },
    },
  };
};