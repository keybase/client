
{unpack,pack} = require './pack'
{Ring} = require './ring'

##=======================================================================

# This is a hack of sorts, in which we've taken the important
# parts of the Msgpack spec for reading an int from the string.
msgpack_frame_len = (buf) ->
  b = buf[0]
  if b < 0x80 then 1
  else if b is 0xcc then 2
  else if b is 0xcd then 3
  else if b is 0xce then 5
  else 0

##=======================================================================

is_array = (a) -> (typeof a is 'object') and Array.isArray a

##=======================================================================

exports.Packetizer = class Packetizer
  """
  A packetizer that is used to read and write to an underlying stream
  (like a Transport below).  Should be inherited by such a class.
  The subclasses should implement:

     @_raw_write(msg,enc) - write this msg to the stream with the
       given encoding. Typically handled at the transport level
       (2 classes higher in the inheritance graph)

     @_packetize_error(err) - report an error with the stream.  Typically
       calls up to the Transport class (2 classes higher).

     @_dispatch(msg) - emit a packetized incoming message. Typically
       handled by the Dispatcher (1 class higher in the inheritance
       graph).

  The subclass should call @packetize_data(m) whenever it has data to stuff
  into the packetizer's input path, and call @send(m) whenever it wants
  to stuff data into the packterizer's output path.

  """

  # The two states we can be in
  FRAME : 1
  DATA  : 2

  # results of getting
  OK : 0
  WAIT : 1
  ERR : -1

  ##-----------------------------------------

  constructor : ->
    @_ring = new Ring()
    @_state = @FRAME
    @_next_msg_len = 0

  ##-----------------------------------------

  send : (msg) ->
    b2 = pack msg
    b1 = pack b2.length
    bufs = [ b1, b2 ]
    rc = 0
    enc = 'binary'

    if @_raw_write_bufs
      @_raw_write_bufs b1, b2
    else
      for b in bufs
        @_raw_write b.toString(enc), enc

    return true

  ##-----------------------------------------

  _get_frame : () ->
    # We need at least one byte to get started
    return @WAIT unless @_ring.len() > 0

    # First get the frame's framing byte! This will tell us
    # how many more bytes we need to grab.  This is a bit of
    # an abstraction violation, but one worth it for implementation
    # simplicity and efficiency.
    f0 = @_ring.grab 1
    return @WAIT unless f0

    frame_len = msgpack_frame_len f0
    unless frame_len
      @_packetize_error "Bad frame header received"
      return @ERR

    # We now know how many bytes to suck in just to get the frame
    # header. If we can't get that much, we'll just have to wait!
    return @WAIT unless (f_full = @_ring.grab frame_len)?

    [w,r] = unpack f_full
    @_packetize_warning w if w?

    res = switch (typ = typeof r)
      when 'number'

        # See implementation of msgpack_frame_len above; this shouldn't
        # happen
        throw new Error "Negative len #{len} should not have happened" if r < 0

        @_ring.consume frame_len
        @_next_msg_len = r
        @_state = @DATA
        @OK
      when 'undefined'
        @WAIT
      else
        @_packetize_error "bad frame; got type=#{typ}, which is wrong"
        @ERR

    return res

  ##-----------------------------------------

  _get_msg: () ->
    l = @_next_msg_len

    ret = if l > @_ring.len() or not (b = @_ring.grab l)?
      @WAIT
    else if not ([pw,msg] = unpack b)? or not msg?
      @_packetize_error "bad encoding found in data/payload; len=#{l}"
      @ERR
    else if not is_array msg
      @_packetize_error "non-array found in data stream: #{JSON.stringify msg}"
      @ERR
    else
      @_ring.consume l
      @_state = @FRAME
      # Call down one level in the class hierarchy to the dispatcher
      @_dispatch msg
      @OK
    @_packetize_warning pw if pw?
    return ret

  ##-----------------------------------------

  packetize_data : (m) ->
    @_ring.buffer m
    go = @OK
    while go is @OK
      go = if @_state is @FRAME then @_get_frame() else @_get_msg()

  ##-----------------------------------------

  # On error we need to flush this guy out.
  _packetizer_reset : () ->
    @_state = @FRAME
    @_ring = new Ring()

##=======================================================================
