/* global module */

// Desktop-only packages with no mobile equivalent.
// Metro stubs these to null-module.js so they never enter the iOS/Android bundle.
// When a merged .tsx file adds a new desktop-only package in a !isMobile branch, add it here.
module.exports = [
  'lottie-web',
  'react-dom',
  '@legendapp/list/react',
  'emoji-datasource-apple/img/apple/sheets/64.png',
]
