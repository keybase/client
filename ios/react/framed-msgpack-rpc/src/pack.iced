# try
#   mp = require 'msgpack'
# catch e

# if not mp?
#   try
pp = require '../../purepack/lib/main'
mp = pp
#  catch e

# if not mp? and not pp?
#  throw new Error "Need either msgpack or purepack to run"

##==============================================================================

_opts = {}

exports.set_opt = set_opt = (k,v) -> _opts[k] = v
exports.set_opts = set_opts = (o) -> _opts = o

# If we want to use byte arrays, we need purepack and not msgpack4 or msgpack!
# exports.use_byte_arrays = () ->
#   if not pp?
#     try
#       mp = pp = require 'purepack'
#     catch err
#       throw new Error "Cannot use_byte_arrays without purepack!"

exports.pack = (b) -> mp.pack b

exports.unpack = (b) ->
  err = dat = null
  try dat = mp.unpack b
  catch err
  [err, dat]

##==============================================================================
