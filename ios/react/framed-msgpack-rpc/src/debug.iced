
##=======================================================================

log = require "./log"

##=======================================================================

# Flags for what fields are in our debug messages
F =
  NONE : 0
  METHOD : 0x1
  REMOTE : 0x2
  SEQID : 0x4
  TIMESTAMP : 0x8
  ERR : 0x10
  ARG : 0x20
  RES : 0x40
  TYPE : 0x80
  DIR : 0x100
  PORT : 0x200
  VERBOSE : 0x400
  ALL : 0xfffffff

F.LEVEL_0 = F.NONE
F.LEVEL_1 = F.METHOD | F.TYPE | F.DIR | F.TYPE
F.LEVEL_2 = F.LEVEL_1 | F.SEQID | F.TIMESTAMP | F.REMOTE | F.PORT
F.LEVEL_3 = F.LEVEL_2 | F.ERR
F.LEVEL_4 = F.LEVEL_3 | F.RES | F.ARG

##=======================================================================

# String versions of these flags
SF =
  m : F.METHOD
  a : F.REMOTE
  s : F.SEQID
  t : F.TIMESTAMP
  p : F.ARG
  r : F.RES
  e : F.ERR
  c : F.TYPE
  d : F.DIRECTION
  v : F.VERBOSE
  P : F.PORT
  A : F.ALL
  0 : F.LEVEL_0
  1 : F.LEVEL_1
  2 : F.LEVEL_2
  3 : F.LEVEL_3
  4 : F.LEVEL_4

##=======================================================================

dir =
  INCOMING : 1
  OUTGOING : 2

flip_dir = (d) -> if d is dir.INCOMING then dir.OUTGOING else dir.INCOMING

##=======================================================================

type =
  SERVER : 1
  CLIENT_NOTIFY : 2
  CLIENT_CALL : 3
  
##=======================================================================

F2S = {}
F2S[F.DIR] = {}
F2S[F.DIR][dir.INCOMING] = "in";
F2S[F.DIR][dir.OUTGOING] = "out";
F2S[F.TYPE] = {};
F2S[F.TYPE][type.SERVER] = "server";
F2S[F.TYPE][type.CLIENT_NOTIFY] = "cli.notify";
F2S[F.TYPE][type.CLIENT_INVOKE] = "cli.invoke";

##=======================================================================

# Finally, export all of these constants...
exports.constants =
  type : type
  dir : dir
  flags : F
  sflags : SF
  field_to_string : F2S

##=======================================================================

#
# Convert a string of the form "1r" to the OR of those
# consituent bitfields.
#
exports.sflags_to_flags = sflags_to_flags = (s) ->
  s = "#{s}"
  res = 0
  for i in [0...s.length]
    c = s.charAt i
    res |= SF[c]
  return res

##=======================================================================

exports.Debugger = class Debugger
  
  constructor : (flags, @log_obj, @log_obj_mthd) ->
    # Potentially convert from strings to integer flags
    @flags = if typeof flags is 'string' then sflags_to_flags flags else flags
    if not @log_obj
      @log_obj = log.new_default_logger()
      @log_obj_mthd = @log_obj.info

  new_message : (dict) ->
    return new Message dict, @

  _output : (json_msg) ->
    @log_obj_mthd.call @log_obj, JSON.stringify json_msg

  _skip_flag : (f) ->
    return f & (F.REMOTE | F.PORT)

  call : (msg) ->
    new_json_msg = {}
    
    # Usually don't copy the arg or res if it's in the other direction,
    # but this can overpower that
    V = @flags & F.VERBOSE
    
    if (@flags & F.TIMESTAMP)
      new_json_msg.timestamp = (new Date()).getTime() / 1000.0

    for key,val of msg.to_json_object()
      uck = key.toUpperCase()
      flag = F[uck]

      do_copy = if @_skip_flag flag then false
      else if (@flags & flag) is 0 then false
      else if key is "res" then msg.show_res V
      else if key is "arg" then msg.show_arg V
      else true

      if do_copy
        val = f2s[val] if (f2s = F2S[flag])?
        new_json_msg[key] = val
        
    @_output new_json_msg

##=======================================================================

exports.Message = class Message
  """A debug message --- a wrapper around a dictionary object, with
  a few additional methods."""

  constructor : (@_msg, @_debugger = null) ->

  response : (error, result) ->
    @_msg.err = error
    @_msg.res = result
    @_msg.dir = flip_dir @_msg.dir
    return @

  to_json_object : -> @_msg

  call : -> @_debugger.call @

  set : (k,v) -> @msg[k] = v

  is_server : -> @_msg.type is type.SERVER
  is_client : -> not @is_server()
  is_incoming : -> @_msg.dir is dir.INCOMING
  is_outgoing : -> not @is_incoming()

  show_arg : (V) ->
    (V or (@is_server() and @is_incoming()) or
          (@is_client() and @is_outgoing()))
          
  show_res : (V) ->
    (V or (@is_server() and @is_outgoing()) or
          (@is_client() and @is_incoming()))

##=======================================================================

exports.make_debugger = (d, lo) ->
  if d is 0 then null else new Debugger d, lo, lo.debug

##=======================================================================
