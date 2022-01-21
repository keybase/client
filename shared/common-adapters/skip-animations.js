// used by babel.config so has to be a js file. restart packager if you change this
const skipAnimations = false
module.exports = skipAnimations

if (skipAnimations) {
  console.log(
    '\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n SKIPPING ANIMATIONS\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n'
  )
}
