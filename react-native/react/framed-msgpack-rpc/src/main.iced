
exports.server       = server       = require './server'
exports.client       = client       = require './client'
exports.transport    = transport    = require './transport'
exports.log          = log          = require './log'
exports.debug        = debug        = require './debug'
exports.pack         = pack         = require './pack'
exports.errors       = errors       = require './errors'

exports.dispatch  = require './dispatch'
exports.listener  = require './listener'

exports.Server = server.Server
exports.SimpleServer = server.SimpleServer
exports.Client = client.Client
exports.Transport = transport.Transport
exports.RobustTransport = transport.RobustTransport
exports.Logger = log.Logger
exports.createTransport = transport.createTransport

##=======================================================================
# Version management...

exports.version     = version = require('./version').version

exports.at_version = (v) ->
  A = version.split '.'
  B = v.split '.'
  while A.length and B.length
    a = parseInt A.shift()
    b = parseInt B.shift()
    if a < b then return false
    else if a > b then return true
  if A.length is 0 and B.length > 0 then false
  else if A.length > 0 and B.length is 0 then true
  else true

#
##=======================================================================
