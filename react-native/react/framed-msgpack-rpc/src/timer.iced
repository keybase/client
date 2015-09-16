

exports.time = time = () -> (new Date()).getTime()

exports.Timer = class Timer
  constructor : (opts) ->
    @reset()
    @start() if opts?.start

  start : () ->
    if not @_running
      @_ts = time()
      @_running = true

  stop : () ->
    if @_running
      @_total += (time() - @_ts)
      @_running = false
    @_total

  is_running : () -> @_running

  total : () -> @_total

  reset : () ->
    @_running = false
    @_total = 0
    @_ts = 0
      
    
