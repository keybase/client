// dev only
// needed by dev server
// @ts-ignore
window.url = require('url')

// if you change this, also change the .prod version!
window.KB = {
  process: {
    env: process.env,
    platform: process.platform,
  },
}
