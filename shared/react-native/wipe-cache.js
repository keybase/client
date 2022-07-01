var os = require('os')
var path = require('path')
var tmpDir = os.tmpdir()
var fs = require('fs')
var exec = require('child_process').exec

var prefix = 'react-packager-cache-'
var dryRun = false

fs.readdir(tmpDir, function(err, files) {
  if (!err && files && files.length) {
    var toWipe = files.filter(function(name) {
      return name.indexOf(prefix) === 0
    })

    toWipe.forEach(function(f) {
      const fullPath = path.join(tmpDir, f)

      if (dryRun) {
        console.log('Dry run: wiping ', fullPath)
      } else {
        exec('rm -r ' + fullPath, function(err, stdout, stderr) {
          if (err) {
            console.log(err)
          }
        })
      }
    })
  }
})
