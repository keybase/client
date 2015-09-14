
util = require 'util'

#=========================================================

exports.BaseError = BaseError = (msg, constructor) ->
  Error.captureStackTrace @, @constructor
  @message = msg or 'Error'
util.inherits BaseError, Error
BaseError.prototype.name = "BaseError"

#=========================================================

to_lower   = (s) -> (s[0].toUpperCase() + s[1...].toLowerCase())
c_to_camel = (s) -> (to_lower p for p in s.split /_/).join ''

make_error_klass = (k, code, default_msg) ->
  ctor = (msg) ->
    BaseError.call(this, (msg or default_msg), this.constructor)
    this.istack = []
    this.code = code
    this
  util.inherits ctor, BaseError
  ctor.prototype.name = k
  ctor.prototype.inspect = () -> "[#{k}: #{this.message} (code #{this.code})]"
  ctor

#=========================================================

exports.make_errors = make_errors = (d) ->
  out =
    msg : {}
    name : {}
    code : {}

  # Constants
  d.OK = "Success"
  errno = 100

  for k,msg of d
    if k isnt "OK"
      enam = (c_to_camel k) + "Error"
      val = errno++
      out[enam] = make_error_klass enam, val, msg
    else
      val = 0
    out[k] = val
    out.msg[k] = out.msg[val] = msg
    out.name[k] = out.name[val] = k
    out.code[k] = val

  out

#=========================================================

ipush = (e, msg) ->
  if msg?
    e.istack = [] unless e.istack?
    e.istack.push msg

# Error short-circuit connector
exports.make_esc = make_esc = (gcb, where) -> (lcb) ->
  (err, args...) ->
    if not err? then lcb args...
    else if not gcb.__esc
      gcb.__esc = true
      ipush err, where
      gcb err

#================================================

# A class-based Error short-circuiter; output OK
exports.EscOk = class EscOk
  constructor : (@gcb, @where) ->

  bailout : () ->
    if @gcb
      t = @gcb
      @gcb = null
      t false

  check_ok : (cb) ->
    (ok, args...) =>
      if not ok then @bailout()
      else cb args...

  check_err : (cb) ->
    (err, args...) =>
      if err?
        ipush err, @where
        @bailout()
      else cb args...

  check_non_null : (cb) ->
    (args...) =>
      if not args[0]? then @bailout()
      else cb args...

#================================================

exports.EscErr = class EscErr
  constructor : (@gcb, @where) ->

  finish : (err) ->
    if @gcb
      t = @gcb
      @gcb = null
      t err

  check_ok : (cb, eclass = Error, emsg = null) ->
    (ok, args...) ->
      if not ok
        err = new eclass emsg
        ipush err, @where
        @finish err
      else cb args...

  check_err : (cb) ->
    (err, args...) ->
      if err?
        ipush err, @where
        @finish err
      else cb args...

#================================================

#
# A class for canceling an expensive operation.
# You can either generate a generic Error or one of the
# Class of your choosing.
#
exports.Canceler = class Canceler
  constructor : (@klass = Error) -> @_canceled = false
  is_canceled : () -> @_canceled
  is_ok       : () -> not @_canceled
  cancel      : () -> @_canceled = true
  err         : () -> if @_canceled then (new @klass "Aborted") else null

#================================================

# Chain callback cb and f
# Call f first, and throw away whatever it calls back with.
# Then call cb, and pass it the args the chain was called back
# with.  This is useful for doing a cleanup routine before
# something exits.
exports.chain = (cb, f) -> (args...) -> f () -> cb args...

#================================================

# Chain callback cb and f
# Call f first, and see if it calls back with a first positional error.
# The error is either the original error, or the error from f.
# Call cb back with args0 unless there was an error in cleanup and no
# error in the original.
exports.chain_err = (cb, f) ->
  (args0...) ->
    f (args1...) ->
      cb (if args1[0]? and not(args0[0]?) then args1 else args0)...

#================================================
