const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    port: 3000,
    host: '0.0.0.0',
    hot: true,
    historyApiFallback: true,
    proxy: [
      {
        context: ['/api', '/media-stream', '/health', '/metrics'],
        target: 'http://localhost:3001',
        ws: true,
      },
      {
        context: ['/socket.io'],
        target: 'http://localhost:3001',
        ws: true,
      },
    ],
  },
});
