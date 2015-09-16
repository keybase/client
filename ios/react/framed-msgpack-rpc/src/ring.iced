
##=======================================================================

Buffer = (require 'buffer').Buffer

exports.Ring = class Ring
  """
  A Ring of buffers. Every so often you'll have to compress buffers into
  smaller buffers, but try to limit that as much as possible....
  """

  #-----------------------------------------

  constructor : ->
    @_bufs = []
    @_len = 0

  #-----------------------------------------

  buffer : (b) ->
    @_bufs.push b
    @_len += b.length

  #-----------------------------------------

  len : () -> @_len

  #-----------------------------------------

  grab : (n_wanted) ->

    # Fail fast if there just aren't enough bytes...
    return null unless n_wanted <= @len()

    # fast-path is that we're already set up
    return @_bufs[0] if @_bufs.length and @_bufs[0].length >= n_wanted

    n_grabbed = 0

    num_bufs = 0
    for b in @_bufs
      n_grabbed += b.length
      num_bufs++
      if n_grabbed >= n_wanted
        break

    # now make a buffer that's potentially bigger than what we wanted
    ret = new Buffer n_grabbed
    n = 0

    # now copy all of those num_bufs into ret
    for b in @_bufs[0...num_bufs]
      b.copy ret, n, 0, b.length
      n += b.length

    # this first buffer that we'll be keeping (the returned buffer)
    first_pos = num_bufs - 1
    @_bufs[first_pos] = ret
    @_bufs = @_bufs[first_pos...]

    return ret

  #-----------------------------------------

  consume : (n) ->
    if @_bufs.length is 0 or (b = @_bufs[0]).length < n
      throw new Error "Ring underflow; can't remove #{n} bytes"
    if b.length == n
      @_bufs = @_bufs[1...]
    else
      @_bufs[0] = b[n...]
    @_len -= n




