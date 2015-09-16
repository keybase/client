
ie = require '../../iced-error'

module.exports = E = ie.make_errors
  UNKNOWN_METHOD : "No method available"
  EOF : "EOF from server"

# Specify a toString() method to be compatible with the old version of our error
E.UnknownMethodError.prototype.toString = () -> "unknown method: #{@method}"


