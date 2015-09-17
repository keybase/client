
{twos_compl_inv} = require './util'

##=======================================================================

NativeBuffer = (require 'buffer').Buffer

##=======================================================================

exports.PpBuffer = class PpBuffer

  #-----------------------------------------

  constructor : (buf) ->
    if not buf?
      @_frozen_buf = null
      @_sub_buffers = []
      @_limits = []

      # _small_buf_sz must be less than _sz; otherwise, crash!
      @_sz = 0x400
      @_small_buf_sz = 0x100

      @_logsz = 10
      @_i = 0
      @_tot = 0
    else
      @_freeze_to buf

  #-----------------------------------------

  _nb  : () -> @_sub_buffers.length     # num buffers
  _ab  : () -> @_sub_buffers[@_nb()-1]  # active buffer
  _lib : () -> 0                        # we'll update this later..

  #-----------------------------------------

  _finish_sub_buffer : () ->
    @_limits.push @_i
    @_i = 0

  #-----------------------------------------

  _push_sub_buffer : (b) ->
    @_finish_sub_buffer() if @_sub_buffers.length
    @_lib = () -> b.length - @_i
    @_sub_buffers.push b
    b

  #-----------------------------------------

  _make_room : () -> @_push_sub_buffer new NativeBuffer @_sz
  _make_room_for_n_bytes : (n) -> @_make_room() if @_lib() < n

  #-----------------------------------------

  push_uint8 : (b) ->
    n = 1
    @_make_room_for_n_bytes n
    @_ab().writeUInt8 b, @_i
    @_i += n
    @_tot += n
  push_int8 : (b) ->
    n = 1
    @_make_room_for_n_bytes n
    @_ab().writeInt8 b, @_i
    @_i += n
    @_tot += n
  push_uint16 : (s) ->
    n = 2
    @_make_room_for_n_bytes n
    @_ab().writeUInt16BE s, @_i
    @_i += n
    @_tot += n
  push_uint32 : (w) ->
    n = 4
    @_make_room_for_n_bytes n
    @_ab().writeUInt32BE w, @_i
    @_i += n
    @_tot += n
  push_int16 : (s) ->
    n = 2
    @_make_room_for_n_bytes n
    @_ab().writeInt16BE s, @_i
    @_i += n
    @_tot += n
  push_int32 : (w) ->
    n = 4
    @_make_room_for_n_bytes n
    @_ab().writeInt32BE w, @_i
    @_i += n
    @_tot += n
  push_float64 : (f) ->
    n = 8
    @_make_room_for_n_bytes n
    @_ab().writeDoubleBE f, @_i
    @_i += n
    @_tot += n
  push_float32 : (f) ->
    n = 4
    @_make_room_for_n_bytes n
    @_ab().writeFloatBE f, @_i
    @_i += n
    @_tot += n

  push_raw_bytes : (s) ->
    @push_buffer( new NativeBuffer s, 'binary' )

  prepare_utf8 : (s) -> new NativeBuffer s, 'utf8'

  push_buffer : (b) ->
    if b.length > @_small_buf_sz
      @_push_sub_buffer b
      @_i = b.length
      @_tot += b.length
    else
      n = Math.min b.length, @_lib()
      if n > 0
        b.copy @_ab(), @_i, 0, n
        @_i += n
        @_tot += n
      if n < b.length
        @_make_room()
        b.copy @_ab(), @_i, n, b.length
        diff = b.length - n
        @_i += diff
        @_tot += diff
    @

  #-----------------------------------------

  freeze : () ->
    if not @_frozen_buf?
      @_finish_sub_buffer()
      lst = []
      for b,i in @_sub_buffers
        if (l = @_limits[i]) is b.length
          lst.push b
        else if l > 0
          lst.push b[0...l]
      @_sub_buffers = []
      @_frozen_buf = NativeBuffer.concat lst, @_tot
    @_frozen_buf

  #-----------------------------------------

  _freeze_to : (b) ->
    @_frozen_buf = b
    @_tot = b.length
    @_sub_buffers = []
    @_cp = 0
    @

  #-----------------------------------------

  bytes_left : () -> @_tot - @_cp

  #-----------------------------------------

  _get : (i) ->
    if i < @_tot then @_frozen_buf.readUInt8(i)
    else throw new Error "read off end of buffer"

  #-----------------------------------------

  read_uint8 : () -> @_get @_cp++
  read_int8  : () -> twos_compl_inv @read_uint8(), 8

  read_uint16 : () ->
    ret = @_frozen_buf.readUInt16BE @_cp
    @_cp += 2
    return ret
  read_uint32 : () ->
    ret = @_frozen_buf.readUInt32BE @_cp
    @_cp += 4
    return ret
  read_int16 : () ->
    ret = @_frozen_buf.readInt16BE @_cp
    @_cp += 2
    return ret
  read_int32 : () ->
    ret = @_frozen_buf.readInt32BE @_cp
    @_cp += 4
    return ret
  read_float64 : () ->
    ret = @_frozen_buf.readDoubleBE @_cp
    @_cp += 8
    return ret
  read_float32 : () ->
    ret = @_frozen_buf.readFloatBE @_cp
    @_cp += 4
    return ret

  #-----------------------------------------

  read_buffer : (n) ->
    bl = @bytes_left()
    if n > bl
      throw new Error "Corruption: asked for #{n} bytes, but only #{bl} available"
    e = @_cp + n
    ret = @_frozen_buf[@_cp...e]
    @_cp = e
    return ret

  #-----------------------------------------

  @isBuffer : (b) -> return NativeBuffer.isBuffer b

##=======================================================================

exports.bufeq = (b1, b2) ->
  return false unless b1.length is b2.length
  for i in [0...b1.lenth]
    if b1.readUInt8(i) isnt b2.readUInt8(i)
      return false
  return true

##=======================================================================
