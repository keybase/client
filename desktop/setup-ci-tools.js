#!/usr/bin/env node
var exec = require('child_process').exec
var devDeps = require('./package.json').devDependencies
var babel = Object.keys(devDeps).filter(k => k.indexOf('babel') !== -1).join(' ')

console.log('Installing ' + babel)
var install = exec('npm i ' + babel, function (err) {
  if (err) {
    console.error(err)
    process.exit(1)
  }
})
