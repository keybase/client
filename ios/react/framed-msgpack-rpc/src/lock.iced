
iced = require('./iced').runtime

##-----------------------------------------------------------------------
 
exports.Lock = class Lock
  constructor : ->
    @_open = true
    @_waiters = []
  acquire : (cb) ->
    if @_open
      @_open = false
      cb()
    else
      @_waiters.push cb
  release : ->
    if @_waiters.length
      w = @_waiters.shift()
      w()
    else
      @_open = true
  open : -> @_open

##-----------------------------------------------------------------------

class NamedLock extends Lock
  constructor : (@tab, @name) ->
    super()
    @refs = 0
  incref : -> ++@refs
  decref : -> --@refs
  release : ->
    super()
    if @decref() is 0
      delete @tab[@name]

##-----------------------------------------------------------------------

exports.Table = class Table
  constructor : ->
    @locks = {}
  create : (name) ->
    l = new NamedLock this, name
    @locks[name] = l
  acquire : (name, cb, wait) ->
    l = @locks[name] or @create(name)
    was_open = l._open
    l.incref()
    if wait or l._open
      await l.acquire defer()
    else
      l = null
    cb l, was_open
  lookup : (name) -> @locks[name]
