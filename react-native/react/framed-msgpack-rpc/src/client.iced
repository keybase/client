
iced = require('./iced').runtime

##========================================================================
 
exports.Client = class Client

  #-----------------------------------------

  constructor : (@transport, @program = null) ->

  #-----------------------------------------

  invoke : (method, args, cb) ->
    arg = { @program, method, args, notify : false }
    await @transport.invoke arg, defer err, res
    cb err, res

  #-----------------------------------------

  notify : (method, args) ->
    method = @make_method method
    program = @_program
    @transport.invoke { @program, method, args, notify : true }
      
##========================================================================
