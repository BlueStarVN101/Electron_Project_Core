const path = require('path');

module.exports = {
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map', 
  mode: process.env.NODE_ENV || 'development',
  entry: './src/renderer/app/renderer.tsx',
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: 'babel-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
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
