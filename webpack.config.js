const path = require('path');

module.exports = {
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map', // Tắt source map trong production
  mode: process.env.NODE_ENV || 'development', // Chọn chế độ dựa trên NODE_ENV
  entry: './src/renderer.tsx',
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: 'babel-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  target: 'electron-renderer'
};
