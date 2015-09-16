# net = require 'net'
{Transport} = require './transport'
{List} = require './list'
log = require './log'
dbg = require './debug'

iced = require('./iced').runtime

##=======================================================================

exports.Listener = class Listener

  ##-----------------------------------------

  constructor : ({@port, @host, @path, @TransportClass, log_obj}) ->
    @TransportClass = Transport unless @TransportClass
    @set_logger log_obj
    @_children = new List
    @_dbgr = null

  ##-----------------------------------------

  _default_logger : ->
    l = log.new_default_logger()
    l.set_prefix "RPC-Server"
    h = @host or "0.0.0.0"
    if @port?
      l.set_remote "#{h}:#{@port}"
    else if @path?
      l.set_remote @path
    return l

  ##-----------------------------------------

  # You actually don't want to apply this to children,
  # since the children will need different loggers and therefore
  # different debuggers.
  set_debugger : (d) ->
    @_dbgr = d

  ##-----------------------------------------

  set_debug_flags : (f, apply_to_children) ->
    @set_debugger dbg.make_debugger f, @log_obj
    if apply_to_children
      @walk_children (c) => c.set_debug_flags f

  ##-----------------------------------------

  set_logger : (o) ->
    o = @_default_logger() unless o?
    @log_obj = o

  ##-----------------------------------------

  # Feel free to change this for your needs (if you want to wrap a connection
  # with something else)...
  make_new_transport : (c) ->
    # Disable Nagle by default
    c.setNoDelay true unless @do_tcp_delay

    x = new @TransportClass
      net_stream : c
      host : c.remoteAddress
      port : c.remotePort
      parent : @
      log_obj : @make_new_log_object c
      dbgr : @_dbgr
    @_children.push x
    return x

  ##-----------------------------------------

  make_new_log_object : (c) ->
    a = c.address()
    r = [ c.address, c.port ].join ":"
    @log_obj.make_child { prefix : "RPC", remote : r }

  ##-----------------------------------------

  walk_children : (fn) -> @_children.walk fn

  ##-----------------------------------------

  close_child : (c) -> @_children.remove c

  ##-----------------------------------------

  set_port : (p) ->
    @port = p

  ##-----------------------------------------

  _got_new_connection : (c) ->
    # Call down to a subclass
    x = @make_new_transport c

    # pure virtual, that a Server-like class will implement
    @got_new_connection x

  ##-----------------------------------------

  got_new_connection : (x) ->
    throw new Error "@got_new_connection() is pure virtual; please implement!"

  ##-----------------------------------------

  _make_server : () ->
    @_net_server = net.createServer (c) => @_got_new_connection c

  ##-----------------------------------------

  close : (cb) ->
    await @_net_server.close defer() if @_net_server
    @_net_server = null
    cb()

  ##-----------------------------------------

  handle_close : () ->
    @log_obj.info "listener closing down"

  ##-----------------------------------------

  # A sensible default handler
  handle_error : (err) ->
    @_net_server = null
    @log_obj.error "error in listener: #{err}"

  ##-----------------------------------------

  _set_hooks : () ->
    @_net_server.on 'error', (err) => @handle_error err
    @_net_server.on 'close', (err) => @handle_close()

  ##-----------------------------------------

  listen : (cb) ->
    @_make_server()

    [ OK, ERR ] = [0..1]
    rv = new iced.Rendezvous
    x = @_net_server
    if @port? then x.listen @port, @host
    else           x.listen @path

    x.on 'error',     rv.id(ERR).defer err
    x.on 'listening', rv.id(OK).defer()

    await rv.wait defer which
    if which is OK
      err = null
      @_set_hooks()
    else
      @log_obj.error err
      @_net_server = null

    cb err

  ##-----------------------------------------

  # specify a delay in seconds, and retry every that many seconds
  # if it fails, in a loop.
  listen_retry : (delay, cb) ->
    go = true
    err = null
    while go
      await @listen defer err
      if err?.code == 'EADDRINUSE'
        @log_obj.warn err
        await setTimeout defer(), delay*1000
      else go = false
    cb err


