console.log('aaa preload main dev')
// dev only
// needed by dev server
window.url = require('url')

// prod also
window.KB = {
    process: {
        env: process.env,
        platform: process.platform
    }
}
