// Builds our code, serves changes if NO_SERVER is false
const path = require('path')
const express = require('express')
const webpack = require('webpack')
const config = Object.assign({}, require('./webpack.config.development'))

const PORT = 4000
const compiler = webpack(config)

// Just build output files and don't run a hot server
const NO_SERVER = (process.env.NO_SERVER && process.env.NO_SERVER == 'true') || false

if (NO_SERVER) {
  console.log('Starting local file build')
  compiler.run(function(err, stats) {
    if(err) {
      console.error(err)
      return
    }
    var jsonStats = stats.toJson()
    if(jsonStats.errors.length > 0) {
      console.error(jsonStats.errors.join('\n'))
      return
    }
    if(jsonStats.warnings.length > 0) {
      console.log(jsonStats.warnings.join('\n'))
      return
    }
    console.log(stats)
  })
} else {
  const app = express()

  app.use(require('webpack-dev-middleware')(compiler, {
    publicPath: config.output.publicPath,
    stats: {
      colors: true,
      quiet: false,
      noInfo: false
    }
  }))

  app.use(require('webpack-hot-middleware')(compiler))

  app.get('*', (req, res) => { res.json({}) })

  app.listen(PORT, 'localhost', err => {
    if (err) {
      console.log(err)
      return
    }

    console.log(`Listening at http://localhost:${PORT}`)
  })
}
