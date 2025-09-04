import path from 'path';
import { fileURLToPath } from 'url';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default (env, argv) => {
  const isDev = argv.mode === 'development';

  return {
    mode: isDev ? 'development' : 'production',
    devtool: isDev ? 'cheap-module-source-map' : false,
    
    entry: {
      'background/service-worker': './src/background/service-worker.js',
      'content/scraper': './src/content/scraper.js',
      'popup/popup': './src/popup/popup.js'
    },
    
    output: {
      path: path.resolve(__dirname, 'build'),
      filename: '[name].js',
      clean: true
    },
    
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        }
      ]
    },
    
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          { 
            from: 'manifest.json', 
            to: 'manifest.json' 
          },
          { 
            from: 'src/popup/popup.html', 
            to: 'popup/popup.html' 
          },
          { 
            from: 'src/popup/popup.css', 
            to: 'popup/popup.css' 
          },
          { 
            from: 'assets/', 
            to: 'assets/',
            noErrorOnMissing: true
          }
        ]
      })
    ],
    
    optimization: {
      minimize: !isDev,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: !isDev,
              drop_debugger: !isDev
            },
            mangle: !isDev,
            format: {
              comments: false
            }
          },
          extractComments: false
        })
      ]
    },
    
    resolve: {
      extensions: ['.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@shared': path.resolve(__dirname, 'src/shared')
      }
    }
  };
};
