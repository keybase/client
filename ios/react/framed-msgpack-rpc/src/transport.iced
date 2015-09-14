{Lock} = require './lock'
{Dispatch} = require './dispatch'
log = require './log'
{Timer} = require './timer'
iced = require('./iced').runtime
dbg = require './debug'

##=======================================================================

#
# A shared wrapper object for which close is idempotent
#
class StreamWrapper
  constructor : (@_net_stream, @_parent) ->
    @_generation = @_parent.next_generation()
    @_write_closed_warn = false

  # Return true if we did the actual close, and false otherwise
  close : ->
    ret = false
    if (x = @_net_stream)?
      ret = true
      @_net_stream = null
      @_parent._dispatch_reset()
      @_parent._packetizer_reset()
      x.end()
    return ret

  write : (msg, enc) ->
    if @_net_stream
      @_net_stream.write msg, enc
    else if not @_write_closed_warn
      @_write_closed_warn = true
      @_parent._warn "write on closed socket..."

  stream         : -> @_net_stream
  is_connected   : -> !! @_net_stream
  get_generation : -> @_generation

  remote_address : () ->
    if @_net_stream then @_net_stream.remoteAddress else null
  remote_port : () ->
    if @_net_stream then @_net_stream.remotePort else null


##=======================================================================

exports.Transport = class Transport extends Dispatch

  ##-----------------------------------------
  # Public API
  #

  constructor : ({ @port, @host, @net_opts, net_stream, @log_obj,
                   @parent, @do_tcp_delay, @hooks, dbgr, @path, connect_timeout}) ->
    super

    @host = "localhost" if not @host or @host is "-"
    @net_opts = {} unless @net_opts
    @net_opts.host = @host
    @net_opts.port = @port
    @net_opts.path = @path
    @_explicit_close = false

    @_remote_str = [ @host, @port].join ":"
    @set_logger @log_obj

    @_lock = new Lock()
    @_generation = 1

    @_dbgr = dbgr

    # Give up on a connection after 10s timeout
    @_connect_timeout = connect_timeout or 10*1000

    # We don't store the TCP stream directly, but rather, sadly,
    # a **wrapper** around the TCP stream.  This is to make stream
    # closes idempotent. The case we want to avoid is two closes
    # on us (due to errors), but the second closing the reconnected
    # stream, rather than the original stream.  This level of
    # indirection solves this.
    @_netw = null

    # potentially set @_netw to be non-null
    @_activate_stream net_stream if net_stream

  ##-----------------------------------------

  set_debugger : (d) -> @_dbgr = d

  ##---------------------------------------

  set_debug_flags : (d) ->
    @set_debugger dbg.make_debugger d, @log_obj

  ##-----------------------------------------

  next_generation : () ->
    """To be called by StreamWrapper objects but not by
    average users."""
    ret = @_generation
    @_generation++
    return ret

  ##-----------------------------------------

  get_generation : () -> if @_netw then @_netw.get_generation() else -1

  ##-----------------------------------------

  remote_address : () -> if @_netw? then @_netw.remote_address() else null
  remote_port : () -> if @_netw? then @_netw.remote_port() else null

  ##-----------------------------------------

  set_logger : (o) ->
    o = log.new_default_logger() unless o
    @log_obj = o
    @log_obj.set_remote @_remote_str

  ##-----------------------------------------

  get_logger : () -> @log_obj

  ##-----------------------------------------

  is_connected : () -> @_netw?.is_connected()

  ##-----------------------------------------

  connect : (cb) ->
    await @_lock.acquire defer()
    if not @is_connected()
      await @_connect_critical_section defer err
    else
      err = null
    @_lock.release()
    cb err if cb
    @_reconnect true if err?

  ##-----------------------------------------

  reset : (w) ->
    w = @_netw unless w
    @_close w

  ##-----------------------------------------

  close : () ->
    @_explicit_close = true
    if @_netw
      @_netw.close()
      @_netw = null

  #
  # /Public API
  ##---------------------------------------------------

  _warn  : (e) -> @log_obj.warn  e
  _info  : (e) -> @log_obj.info  e
  _fatal : (e) -> @log_obj.fatal e
  _debug : (e) -> @log_obj.debug e
  _error : (e) -> @log_obj.error e

  ##-----------------------------------------

  _close : (netw) ->
    # If an optional close hook was specified, call it here...
    @hooks?.eof? netw
    @_reconnect false if netw.close()

  ##-----------------------------------------

  _handle_error : (e, netw) ->
    @_error e
    @_close netw

  ##-----------------------------------------

  _packetize_error : (err) ->
    # I think we'll always have the right TCP stream here
    # if we grab the one in the this object.  A packetizer
    # error will happen before any errors in the underlying
    # stream
    @_handle_error "In packetizer: #{err}", @_netw

  _packetize_warning : (w) ->
    @_warn "In packetizer: #{w}"

  ##-----------------------------------------

  _handle_close : (netw) ->
    @_info "EOF on transport" unless @_explicit_close
    @_close netw

    # for TCP connections that are children of Listeners,
    # we close the connection here and disassociate
    @parent.close_child @ if @parent

  ##-----------------------------------------

  # In other classes we can override this...
  # See 'RobustTransport'
  _reconnect : (first_time) -> null

  ##-----------------------------------------

  _activate_stream : (x) ->

    @_info "connection established"


    # The current generation needs to be wrapped into this hook;
    # this way we don't close the next generation of connection
    # in the case of a reconnect....
    w = new StreamWrapper x, @
    @_netw = w

    # If optional hooks were specified, call them here; give as an
    # argument the new StreamWrapper so that way the subclass can
    # issue closes on the connection
    @hooks?.connected w

    #
    # MK 2012/12/20 -- Revisit me!
    #
    # It if my current belief that we don't have to listen to the event
    # 'end', because a 'close' event will always follow it, and we do
    # act on the close event. The distance between the two gives us
    # the time to act on a TCP-half-close, which we are not doing.
    # So for now, we are going to ignore the 'end' and just act
    # on the 'close'.
    #
    x.on 'error', (err) => @_handle_error err, w
    x.on 'close', ()    => @_handle_close w
    x.on 'data',  (msg) => @packetize_data msg

  ##-----------------------------------------

  _connect_critical_section : (cb) ->
    x = net.connect @net_opts
    x.setNoDelay true unless @do_tcp_delay

    # Some local switch codes....
    [ CON, ERR, CLS, TMO ] = [0..3]

    # We'll take any one of these three events...
    rv = new iced.Rendezvous
    x.once 'connect', rv.id(CON).defer()
    x.once 'error',   rv.id(ERR).defer(err)
    x.once 'close',   rv.id(CLS).defer()

    # Also, if the connection times out, let's abandon ship
    # and try again.  By default, this is for 10s
    setTimeout rv.id(TMO).defer(), @_connect_timeout

    ok = false
    await rv.wait defer rv_id

    switch rv_id
      when CON then ok = true
      when ERR then @_warn err
      when CLS then @_warn "connection closed during open"
      when TMO then @_warn "connection timed out after #{@_connect_timeout}s"

    if ok
      # Now remap the event emitters
      @_activate_stream x
      err = null
    else if not err?
      err = new Error "error in connection"

    cb err

  ##-----------------------------------------
  # To fulfill the packetizer contract, the following...

  _raw_write : (msg, encoding) ->
    if not @_netw?
      @_warn "write attempt with no active stream"
    else
      @_netw.write msg, encoding

  ##-----------------------------------------

##=======================================================================

exports.RobustTransport = class RobustTransport extends Transport

  ##-----------------------------------------

  # Take two dictionaries -- the first is as in Transport,
  # and the second is configuration parameters specific to this
  # transport.
  #
  #    reconnect_delay -- the number of seconds to delay between attempts
  #       to reconnect to a downed server.
  #
  #    queue_max -- the limit to how many calls we'll queue while we're
  #       waiting on a reconnect.
  #
  #    warn_threshhold -- if a call takes more than this number of seconds,
  #       a warning will be fired when the RPC completes.
  #
  #    error_threshhold -- if a call *is taking* more than this number of
  #       seconds, we will make an error output while the RPC is outstanding,
  #       and then make an error after we know how long it took.
  #
  #
  constructor : (sd, d = {}) ->
    super sd

    { @queue_max, @warn_threshhold, @error_threshhold } = d

    # in seconds, provide a default of 1s for a reconnect delay
    # if none was given.  Also, 0 is not a valid value.
    @reconnect_delay = if (x = d.reconnect_delay) then x else 1

    # For @queue_max, a value of '0' means don't queue, but a null
    # or unspecifed value means use a reasonable default, which we
    # supply here as 1000.
    @queue_max = 1000 unless @queue_max?

    @_time_rpcs = @warn_threshhold? or @error_threshhold?

    @_waiters = []

  ##-----------------------------------------

  _reconnect : (first_time) ->
    # Do not reconnect on an explicit close
    @_connect_loop first_time if not @_explicit_close

  ##-----------------------------------------

  _flush_queue : () ->
    tmp = @_waiters
    @_waiters = []
    for w in tmp
      @invoke w...

  ##-----------------------------------------

  _connect_loop : (first_time = false, cb) ->
    prfx = if first_time then "" else "re"
    i = 0

    await @_lock.acquire defer()

    go = true
    first_through_loop = true

    while go
      if @is_connected() or @_explicit_close
        go = false
      else if first_through_loop and not first_time
        first_through_loop = false
        @_info "reconnect loop started, initial delay..."
        await setTimeout defer(), @reconnect_delay*1000
      else
        i++
        @_info "#{prfx}connecting (attempt #{i})"
        await @_connect_critical_section defer err
        if err?
          await setTimeout defer(), @reconnect_delay*1000
        else
          go = false

    if @is_connected()
      s = if i is 1 then "" else "s"
      @_warn "#{prfx}connected after #{i} attempt#{s}"
      @_flush_queue()

    @_lock.release()
    cb() if cb

  ##-----------------------------------------

  _timed_invoke : (arg, cb) ->

    [ OK, TIMEOUT ] = [0..1]
    tm = new Timer start : true
    rv = new iced.Rendezvous
    meth = @make_method arg.program, arg.method

    et = if @error_threshhold then @error_threshhold*1000 else 0
    wt = if @warn_threshhold then @warn_threshhold*1000 else 0

    # Keep a handle to this timeout so we can clear it later on success
    to = setTimeout rv.id(TIMEOUT).defer(), et if et

    # Make the actual RPC
    Dispatch.prototype.invoke.call @, arg, rv.id(OK).defer rpc_res...

    # Wait for the first one...
    await rv.wait defer which

    # will we leak memory for the calls that never come back?
    flag = true

    while flag
      if which is TIMEOUT
        @_error "RPC call to '#{meth}' is taking > #{et/1000}s"
        await rv.wait defer which
      else
        clearTimeout to
        flag = false

    dur = tm.stop()

    m =  if et and dur >= et then @_error
    else if wt and dur >= wt then @_warn
    else                     null

    m.call @, "RPC call to '#{meth}' finished in #{dur/1000}s" if m

    cb rpc_res...

  ##-----------------------------------------

  invoke : (arg, cb) ->
    meth = @make_method arg.program, arg.method
    if @is_connected()
      if @_time_rpcs then @_timed_invoke arg, cb
      else                super arg, cb
    else if @_explicit_close
      @_warn "invoke call after explicit close"
      cb "socket was closed", {}
    else if @_waiters.length < @queue_max
      @_waiters.push [ arg, cb ]
      @_info "Queuing call to #{meth} (num queued: #{@_waiters.length})"
    else if @queue_max > 0
      @_warn "Queue overflow for #{meth}"

##=======================================================================

exports.createTransport = (opts) ->
  if opts.robust then new RobustTransport opts, opts
  else                new Transport opts

##=======================================================================

