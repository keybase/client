;(() => {
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
