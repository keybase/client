;(() => {
  // dev only
  // needed by dev server
  // @ts-ignore
  window.url = require('url')

  // if you change this, also change the .prod version!
  const path = require('path')
  window.KB = {
    path: {
      join: path.join,
    },
    process: {
      env: process.env,
      platform: process.platform,
    },
  }
})()
