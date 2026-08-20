import path from 'node:path';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { buildSceneEngineBenchmarkManifest } from
  './scripts/sceneEngineBenchmarkManifest.mjs';

const repoRoot = path.resolve('.');
const manifest = buildSceneEngineBenchmarkManifest(repoRoot);
const publicManifest = manifest.map(({ filePath: _filePath, ...scene }) => ({
  ...scene,
  url: `./scene-engine-scenes/${scene.index}.json`,
}));

class SceneEngineBenchmarkManifestPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap(
      'SceneEngineBenchmarkManifestPlugin',
      compilation => {
        compilation.hooks.processAssets.tap(
          {
            name: 'SceneEngineBenchmarkManifestPlugin',
            stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
          },
          () => {
            compilation.emitAsset(
              'experiments/scene-engine-benchmark-manifest.json',
              new compiler.webpack.sources.RawSource(
                JSON.stringify(publicManifest)
              )
            );
          }
        );
      }
    );
  }
}

export default {
  entry: './scripts/benchmarkSceneEngines.js',
  output: {
    filename: 'experiments/scene-engine-benchmark.js',
    path: path.resolve('dist'),
  },
  optimization: {
    minimize: true,
    runtimeChunk: false,
    splitChunks: false,
  },
  module: {
    rules: [
      { test: /\.html$/, use: ['html-loader'] },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: 'asset/resource',
        generator: { filename: 'img/[name][ext]' },
      },
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'scripts/benchmarkSceneEngines.html',
          to: 'experiments/scene-engine-benchmark.html',
        },
        ...manifest.map(scene => ({
          from: scene.filePath,
          to: `experiments/scene-engine-scenes/${scene.index}.json`,
        })),
      ],
    }),
    new SceneEngineBenchmarkManifestPlugin(),
  ],
  cache: { type: 'filesystem' },
  mode: 'production',
  resolve: {
    alias: { mathjs: path.resolve('node_modules/mathjs') },
  },
};
