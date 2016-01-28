export default class EngineError extends Error {
  constructor (err) {
    if (!err) {
      err = {}
    }
    super(err.desc)
    this.code = err.code
    this.desc = err.desc
    this.name = err.name
  }

  toString () {
    switch (this.name) {
      case EngineError.ALREADY_LOGGED_IN:
        return 'You are already logged in'
      case EngineError.API_NETWORK_ERROR:
        return 'Networking error, try again'
      case EngineError.BAD_LOGIN_PASSWORD:
        return 'Invalid login'
      case EngineError.CANCELED:
      case EngineError.GENERIC:
      case EngineError.IDENTIFICATION_EXPIRED:
      case EngineError.KEY_BAD_GEN:
      case EngineError.KEY_IN_USE:
      case EngineError.KEY_NOT_FOUND:
      case EngineError.KEY_NO_ACTIVE:
      case EngineError.KEY_NO_SECRET:
      case EngineError.LOGIN_REQUIRED:
      case EngineError.PROOF_ERROR:
      case EngineError.SC_KEY_NO_ACTIVE:
      case EngineError.SC_STREAM_NOT_FOUND:
      case EngineError.SC_TIMEOUT:
      case EngineError.SELF_NOT_FOUND:
      case EngineError.STREAM_EOF:
      case EngineError.STREAM_EXISTS:
      case EngineError.STREAM_WRONG_KIND:
      default:
        return this.desc
    }
    return JSON.stringify(this)
  }
}

// Error codes from libkb/rpc_exim.go
EngineError.ALREADY_LOGGED_IN = 'ALREADY_LOGGED_IN'
EngineError.API_NETWORK_ERROR = 'API_NETWORK_ERROR'
EngineError.BAD_LOGIN_PASSWORD = 'BAD_LOGIN_PASSWORD'
EngineError.CANCELED = 'CANCELED'
EngineError.GENERIC = 'GENERIC'
EngineError.IDENTIFICATION_EXPIRED = 'IDENTIFICATION_EXPIRED'
EngineError.KEY_BAD_GEN = 'KEY_BAD_GEN'
EngineError.KEY_IN_USE = 'KEY_IN_USE'
EngineError.KEY_NOT_FOUND = 'KEY_NOT_FOUND'
EngineError.KEY_NO_ACTIVE = 'KEY_NO_ACTIVE'
EngineError.KEY_NO_SECRET = 'KEY_NO_SECRET'
EngineError.LOGIN_REQUIRED = 'LOGIN_REQUIRED'
EngineError.PROOF_ERROR = 'PROOF_ERROR'
EngineError.SC_KEY_NO_ACTIVE = 'SC_KEY_NO_ACTIVE'
EngineError.SC_STREAM_NOT_FOUND = 'SC_STREAM_NOT_FOUND'
EngineError.SC_TIMEOUT = 'SC_TIMEOUT'
EngineError.SELF_NOT_FOUND = 'SELF_NOT_FOUND'
EngineError.STREAM_EOF = 'STREAM_EOF'
EngineError.STREAM_EXISTS = 'STREAM_EXISTS'
EngineError.STREAM_WRONG_KIND = 'STREAM_WRONG_KIND'
