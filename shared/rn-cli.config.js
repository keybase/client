// @flow
console.log('KB rn-cli.config.js loaded')
module.exports = {
  projectRoot: __dirname,
  transformer: {
    minifierConfig: {
      mangle: {
        keep_fnames: true,
      },
    },
  },
}
