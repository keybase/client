
{Listener} = require './listener'

##=======================================================================

# Collect all methods that start with "h_"s.  These are handler
# hooks and will automatically assume a program with this function
exports.collect_hooks = collect_hooks =  (proto) ->
  re = /^h_(.*)$/
  hooks = {}
  for k,v of proto
    if (m = k.match re)?
      hooks[m[1]] = v
  return hooks

##=======================================================================

exports.Server = class Server extends Listener
  """This server is connection-centric. When the handlers of the
  passed programs are invoked, the 'this' object to the handler will
  be the Transport that's handling that client. This server is available
  via this.parent.

  Note you can pass a TransportClass to use instead of the Transport.
  It should be a subclass of Transport.
  """

  #-----------------------------------------

  constructor : (d) ->
    super d
    @programs = d.programs

  #-----------------------------------------

  got_new_connection : (c) ->
    # c inherits from Dispatch, so it should have an add_programs
    # method.  We're just going to shove into it
    c.add_programs @programs

##=======================================================================

exports.SimpleServer = class SimpleServer extends Listener

  constructor : (d) ->
    super d
    @_program = d.program

  get_hook_wrapper : () -> null

  got_new_connection : (c) ->
    @_hooks = collect_hooks @
    c.add_program @get_program_name(), @_hooks

  set_program_name : (p) ->
    @_program = p

  get_program_name : () ->
    r = @_program
    throw new Error "No 'program' given" unless r?
    return r

  make_new_transport : (c) ->
    x = super c
    x.get_handler_this = (m) => @
    x.get_hook_wrapper = () => @get_hook_wrapper()
    return x

##=======================================================================

#
# Your class can be much cooler, maybe this is where you put all of your
# application logic.
#
# If you put hooks of the form:
#
#    h_foo : (arg,res) ->
#
# Then they will be automatically rolled up into a program, handled by
# this class.
#
exports.Handler = class Handler
  constructor : ({@transport, @server}) ->

  # Collect all methods that start with "h_"s.  These are handler
  # hooks and will automatically assume a program with this function
  @collect_hooks : () -> collect_hooks @prototype

##=======================================================================

exports.ContextualServer = class ContextualServer extends Listener
  """This exposes a slightly different object as `this` to RPC
  handlers -- in this case, it a Handler object that points to be both
  the parent server, and also the child transport.  So both are accessible
  via 'has-a' rather than 'is-a' relationships."""

  constructor : (d) ->
    super d
    @programs = {}
    @classes = d.classes
    for n,klass of @classes
      @programs[n] = klass.collect_hooks()

  #-----------------------------------------

  got_new_connection : (c) ->
    # c inherits from Dispatch, so it should have an add_programs
    # method.  We're just going to shove into it
    c.add_programs @programs

  #-----------------------------------------

  make_new_transport : (c) ->
    x = super c

    ctx = {}
    for n,klass of @classes
      ctx[n] = new klass { transport : x, server: @ }

    # This is sort of a hack, but it should work and override the
    # prototype.  The alternative is to bubble classes up and down the
    # class hierarchy, but this is much less code.
    x.get_handler_this = (m) ->
      pn = m.split(".")[0...-1].join(".")
      # This really ought not happen
      throw new Error "Couldn't find prog #{pn}" unless (obj = ctx[pn])?
      return obj

    return x

##=======================================================================
