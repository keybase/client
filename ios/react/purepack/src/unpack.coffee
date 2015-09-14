
{C} = require './const'
{bufeq,PpBuffer} = require './buffer'
{pow2,twos_compl_inv,U32MAX} = require './util'
{pack} = require './pack'

##=======================================================================a

modes =
  NONE : 0
  BINARY : 1
  START : 2

##=======================================================================

default_ext = (type, raw) -> { type, raw }

##=======================================================================

exports.Unpacker = class Unpacker

  constructor : (b, @_opts = {})  ->
    @_orig_buffer = b
    @_buffer = new PpBuffer b
    @_ext = @_opts.ext or (if @_opts.no_ext then null else default_ext)

  #-----------------------------------------

  u_buf : (n) -> @_buffer.read_buffer n
  u_str : (n) -> @u_buf(n).toString('utf8')
  u_bin : (n) -> @u_buf(n)

  #-----------------------------------------

  u_ext : (n) ->
    typ = @u_uint8()
    buf = @u_buf n
    if @_opts.ext? then @_opts.ext(typ,buf)
    else throw new Error "No ext hook but got message type: #{typ}"

  #-----------------------------------------

  u_array : (n) -> (@u() for i in [0...n])

  #-----------------------------------------

  u_map : (n) ->
    ret = {}
    keys = []
    for i in [0...n]
      key = @u()
      keys.push key
      throw new Error "duplicate key '#{key}'" if ret[key]?
      ret[key] = @u()
    if @_opts.strict
      for i in [0...keys.length - 1]
        if keys[i] > keys[i+1]
          throw new Error "unsorted object keys in strict mode: #{keys[i]} > #{keys[i+1]}"
    return ret

  #-----------------------------------------

  u_uint8  : () -> @_buffer.read_uint8()
  u_uint16 : () -> @_buffer.read_uint16()
  u_uint32 : () -> @_buffer.read_uint32()
  u_int8   : () -> @_buffer.read_int8()
  u_int16  : () -> @_buffer.read_int16()
  u_int32  : () -> @_buffer.read_int32()
  u_uint64 : () -> (@u_uint32() * U32MAX) + @u_uint32()

  #-----------------------------------------

  u_double : () -> @_buffer.read_float64()
  u_float  : () -> @_buffer.read_float32()

  #-----------------------------------------

  # This is, as usual, a bit subtle.  Here is what we get:
  #
  #     x = 2^32*a + b
  #
  # comes in out of the buffer, by calling u_uint32() as normal.
  # We seek the value x - 2^64 as the output, but we have to do it
  # in a smart way.  So we write:
  #
  #    x - 2^64 = 2^32*a + b - 2^64
  #
  # And factor:
  #
  #    x - 2^64 = 2^32(a - 2^32) + b
  #
  # And this is good enough, since (a - 2^32) is going to have a small
  # absolute value, for small values of a.
  #
  u_int64 : () ->
    [a,b] = (@u_uint32() for i in [0...2])
    U32MAX*(a - U32MAX) + b

  #-----------------------------------------

  u : () ->
    if (b = @u_uint8()) <= C.positive_fix_max then b
    else if b >= C.negative_fix_min and b <= C.negative_fix_max
      twos_compl_inv b, 8
    else if b >= C.fix_str_min and b <= C.fix_str_max
      l = (b & C.fix_str_count_mask)
      @u_str l
    else if b >= C.fix_array_min and b <= C.fix_array_max
      l = (b & C.fix_array_count_mask)
      @u_array l
    else if b >= C.fix_map_min and b <= C.fix_map_max
      l = (b & C.fix_map_count_mask)
      @u_map l
    else
      switch b
        when C.null  then null
        when C.true  then true
        when C.false then false
        when C.uint8 then @u_uint8()
        when C.uint16 then @u_uint16()
        when C.uint32 then @u_uint32()
        when C.uint64 then @u_uint64()
        when C.int8 then @u_int8()
        when C.int16 then @u_int16()
        when C.int32 then @u_int32()
        when C.int64 then @u_int64()
        when C.double then @u_double()
        when C.float then @u_float()
        when C.str8 then @u_str @u_uint8()
        when C.str16 then @u_str @u_uint16()
        when C.str32 then @u_str @u_uint32()
        when C.bin8 then @u_bin @u_uint8()
        when C.bin16 then @u_bin @u_uint16()
        when C.bin32 then @u_bin @u_uint32()
        when C.array16 then @u_array @u_uint16()
        when C.array32 then @u_array @u_uint32()
        when C.map16 then @u_map @u_uint16()
        when C.map32 then @u_map @u_uint32()
        when C.fix_ext1 then @u_ext 1
        when C.fix_ext2 then @u_ext 2
        when C.fix_ext4 then @u_ext 4
        when C.fix_ext8 then @u_ext 8
        when C.fix_ext16 then @u_ext 16
        when C.ext8 then @u_ext @u_uint8()
        when C.ext16 then @u_ext @u_uint16()
        when C.ext32 then @u_ext @u_uint32()
        else throw new Error "unhandled type #{b}"

  #-----------------------------------------

  unpack : () ->
    res = @u()
    if @_opts.strict
      our_encoding = pack res, { sort_keys : true }
      if (a = our_encoding.length) isnt (b = @_orig_buffer.length)
        throw new Error "encoding size mismatch: wanted #{a} but got #{b}"
      else if not bufeq our_encoding, @_orig_buffer
        throw new Error "Got non-standard encoding in strict mode"
    return res

##=======================================================================

# @param {Buffer} x The buffer to decode
# @option opts {function} ext An 'extensible' encode function. Given a [type,buf]
#   pair, should return an object or throw an error.
# @option opts {bool} no_ext A flag to turn off the default extensible encoder
#   and just throw an error if we encounter an extensible object in the stream
#
exports.unpack = (x, opts = {}) ->
  unpacker = new Unpacker x, opts
  unpacker.unpack()

##=======================================================================
