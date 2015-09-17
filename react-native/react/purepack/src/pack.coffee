
{C} = require './const'
{PpBuffer} = require './buffer'
{U32MAX} = require './util'

##===============/p========================================================

is_array = (x) -> Object.prototype.toString.call(x) is '[object Array]'
is_int = (f) -> Math.floor(f) is f

##=======================================================================
#
# u64max_minus_i
#
# The challenge is, given a positive integer i, to express
# 2^64 - i as per standard 2's complement, and then put both
# words in the buffer stream.  There's the way it's done:
#
#   Given input i>=0, pick x and y such that i = 2^32 x + y,
#   where x,y are both positive, and both less than 2^32.
#
#   Now we can write:
#
#       2^64 - i = 2^64 - 2^32 x - y
#
#   Factoring and rearranging:
#
#       2^64 - i = 2^32 * (2^32 - x - 1) + (2^32 - y)
#
#   Thus, we've written:
#
#        2^64 - i =  2^32 a + b
#
#   Where 0 <= a,b < 2^32. In particular:
#
#       a = 2^32 - x - 1
#       b = 2^32 - y
#
#   And this satisfies our need to put two positive ints into
#   stream.
#
u64max_minus_i = (i) ->
  x = Math.floor( i / U32MAX)
  y = i % U32MAX
  a = U32MAX - x - (if y > 0 then 1 else 0)
  b = if y is 0 then 0 else U32MAX - y
  return [a, b]

##=======================================================================

exports.Packer = class Packer

  #-----------------------------------------

  constructor: (@_opts = {}) ->
    @_buffer = new PpBuffer()

  #-----------------------------------------

  output : () -> @_buffer.freeze()

  #-----------------------------------------

  p : (o) ->
    switch typeof o
      when 'number'                           then @p_number o
      when 'string'                           then @p_str o
      when 'boolean'                          then @p_boolean o
      when 'undefined'                        then @p_null()
      when 'object'
        if not o?                             then @p_null()
        else if is_array o                    then @p_array o
        else if PpBuffer.isBuffer o           then @p_bin o
        else if not @p_ext(o)                 then @p_obj o

  #-----------------------------------------

  p_number : (n) ->
    if not is_int n then @p_pack_double n
    else if n >= 0  then @p_positive_int n
    else                 @p_negative_int n

  #-----------------------------------------

  p_pack_double : (d) ->
    if @_opts.floats?
      @p_uint8 C.float
      @_buffer.push_float32 d
    else
      @p_uint8 C.double
      @_buffer.push_float64 d

  #-----------------------------------------

  p_uint8  : (b) -> @_buffer.push_uint8  b
  p_uint16 : (s) -> @_buffer.push_uint16 s
  p_uint32 : (w) -> @_buffer.push_uint32 w
  p_int8   : (b) -> @_buffer.push_int8  b
  p_int16  : (s) -> @_buffer.push_int16 s
  p_int32  : (w) -> @_buffer.push_int32 w

  #-----------------------------------------

  #
  # p_neg_int64 -- Pack integer i < -2^31 into a signed quad,
  #   up until the JS resolution cut-off at least.
  #
  #
  p_neg_int64 : (i) ->
    abs_i = 0 - i
    [a,b] = u64max_minus_i abs_i
    @p_uint32 a
    @p_uint32 b

  #-----------------------------------------

  p_boolean : (b) -> @p_uint8 if b then C.true else C.false
  p_null :    ()  -> @p_uint8 C.null

  #-----------------------------------------

  p_array : (a) ->
    @p_len a.length, C.fix_array_min, C.fix_array_max, C.array16, C.array32
    @p e for e in a

  #-----------------------------------------

  # Serial with keys sorted in-order so that we can use these things
  # in hashes and signatures.
  p_obj : (o) ->
    keys = Object.keys o
    n = keys.length
    @p_len n, C.fix_map_min, C.fix_map_max, C.map16, C.map32
    keys.sort() if @_opts.sort_keys
    for k in keys
      @p k
      @p o[k]

  #-----------------------------------------

  p_positive_int : (i) ->
    if i <= 0x7f then @p_uint8 i
    else if i <= 0xff
      @p_uint8 C.uint8
      @p_uint8 i
    else if i <= 0xffff
      @p_uint8 C.uint16
      @p_uint16 i
    else if i < U32MAX
      @p_uint8 C.uint32
      @p_uint32 i
    else
      @p_uint8 C.uint64
      @p_uint32 Math.floor(i / U32MAX)
      @p_uint32 (i % U32MAX)

  #-----------------------------------------

  p_negative_int : (i) ->
    if i >= -32 then @p_int8 i
    else if i >= -128
      @p_uint8 C.int8
      @p_int8 i
    else if i >= -32768
      @p_uint8 C.int16
      @p_int16 i
    else if i >= -2147483648
      @p_uint8 C.int32
      @p_int32 i
    else
      @p_uint8 C.int64
      @p_neg_int64 i

  #-----------------------------------------

  p_buffer : (b) ->
    @_buffer.push_buffer b

  #-----------------------------------------

  p_bin : (r) ->
    @p_len r.length, null, null, C.bin16, C.bin32, C.bin8
    @p_buffer r

  #-----------------------------------------

  p_str : (s) ->
    # Given a string, the first thing we do is convert it to a UTF-8 sequence
    # of raw bytes in a byte array.  The character '\x8a' will be converted
    # to "\xc2\x8a".  We then encode this string.  We need to do this conversion
    # outside the buffer class since we need to know the string length to encode
    # up here.
    b = @_buffer.prepare_utf8 s

    # we can turn this option off to be compatible with older msgpacks...
    str8 = if @_opts.no_str8 then null else C.str8

    @p_len b.length, C.fix_str_min, C.fix_str_max, C.str16, C.str32, str8
    @p_buffer b

  #-----------------------------------------

  p_len : (l, fixmin, fixmax, m, b, s = null) ->
    if fixmin? and fixmax? and l <= (fixmax - fixmin)
      @p_uint8 (l|fixmin)
    else if s? and l <= 0xff
      @p_uint8 s
      @p_uint8 l
    else if l <= 0xffff
      @p_uint8 m
      @p_uint16 l
    else
      @p_uint8 b
      @p_uint32 l

  #-----------------------------------------

  p_ext : (o) ->
    if not @_opts.ext? then false
    else if not (ret = @_opts.ext o) then false
    else
      [type,buf] = ret
      switch (l = buf.length)
        when 1  then @p_uint8 C.fix_ext1
        when 2  then @p_uint8 C.fix_ext2
        when 4  then @p_uint8 C.fix_ext4
        when 8  then @p_uint8 C.fix_ext8
        when 16 then @p_uint8 C.fix_ext16
        else
          if l <= 0xff
            @p_uint8 C.ext8
            @p_uint8 l
          else if l <= 0xffff
            @p_uint8 C.ext16
            @p_uint16 l
          else
            @p_uint8 C.ext32
            @p_uint32 l
      @p_uint8 type
      @p_buffer buf
      true

##=======================================================================

# Opts can be:
#   - floats      - use floats, not double in encodings...
#   - sort_keys   - sort keys when outputting objects (for hash comparisons esp.)
#   - ext         - an "extensible hook" which returns [type,buf] on an object if it's
#                   to be encoded as an extensible object, and null if it's not
#   - no_str8     - don't use str8's, to be compatible with old msgpacks
exports.pack = (x, opts = {} ) ->
  packer = new Packer opts
  packer.p x
  packer.output()

