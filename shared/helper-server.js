// @flow
var http = require('http')
var fs = require('fs')
var server = http.createServer(function(request, response) {
  var req = request
  response.writeHead(200, {'Content-Type': 'textplain'})
  if (req.method === 'POST') {
    console.log('POST')
    var body = ''
    req.on('data', function(data) {
      body += data
      console.log('Partial body: ' + body)
    })
    req.on('end', function() {
      console.log('Body: ' + body)
      fs.writeFile(`/Users/marcomunizaga/android-timings/${new Date().toISOString()}.json`, body, function(err, data) {
        if (err) {
          console.log('err writing', err)
        }
      })
    })
    response.writeHead(200, {'Content-Type': 'text/html'})
    response.end('post received')
  }
  if (request.method == 'GET') {
    response.end('received GET request.')
  } else {
    response.end('Undefined request .')
  }
})

server.listen(7008)
console.log('Server running on port 7008')
