// Builds our code for tests
const webpack = require('webpack')
const config = Object.assign({}, require('./webpack.config.test'))
const compiler = webpack(config)
const getenv = require('getenv')
const Mocha = require('mocha')
const execSync = require('child_process').execSync

if (getenv.boolish('WATCH', false)) {
  var mocha = new Mocha()
  mocha.addFile('./dist/test.bundle.js')
  compiler.watch({}, function (err, stats) {
    if (err) {
      console.error(err)
      return
    }
    var jsonStats = stats.toJson()
    if (jsonStats.errors.length > 0) {
      console.error(jsonStats.errors.join('\n'))
      return
    }
    if (jsonStats.warnings.length > 0) {
      console.log(jsonStats.warnings.join('\n'))
      return
    }
    console.log('done, running tests')
    try {
      execSync('npm run mocha', {stdio: [0, 1, 2]})
    } catch (e) {
      console.log('error in test')
    }
    console.log('done with tests')
  })
} else {
  compiler.run(function (err, stats) {
    if (err) {
      console.error(err)
      return
    }
    var jsonStats = stats.toJson()
    if (jsonStats.errors.length > 0) {
      console.error(jsonStats.errors.join('\n'))
      return
    }
    if (jsonStats.warnings.length > 0) {
      console.log(jsonStats.warnings.join('\n'))
      return
    }
    console.log('Done compiling')
  })
}
