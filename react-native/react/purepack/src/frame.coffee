
{pack} = require './pack'
{unpack} = require './unpack'
{C} = require './const'

#---------------------------------------------------------------

exports.pack = (x, opts = {}) ->
  b2 = pack x, opts
  b1 = pack b2.length
  Buffer.concat [ b1, b2 ]

#---------------------------------------------------------------

exports.frame_len = frame_len = (c) ->
  if c <= C.positive_fix_max then 1
  else if c is C.uint8 then 2
  else if c is C.uint16 then 3
  else if c is C.uint32 then 5
  else 0

#---------------------------------------------------------------

exports.unpack = (x, opts = {}) ->
  if x.length < 1 
    throw new Error "need a buffer > 1 bytes"
  c = x.readUInt8(0)
  flen = frame_len c
  if flen is 0 
    throw new Error "no data frame found"
  if x.length < flen 
    throw new Error "not enough bytes to read frame: #{x.length} < #{flen}"
  buf = x[0...flen]
  plen = unpack buf
  x = x[flen...]
  if x.length < plen
    throw new Error "not enough bytes to unframe: #{x.length} < #{plen}"
  rem = x[plen...]
  x = x[0...plen]
  ret = unpack x
  return [ret, rem]

#---------------------------------------------------------------

