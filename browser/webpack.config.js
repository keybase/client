const path = require('path');

const config = {
  entry: './js/bundle.entry.js',
  output: {
    library: 'bundle',
    filename: 'bundle.js',
    path: path.join(__dirname, 'js')
  }
};

module.exports = config;
