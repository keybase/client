const bind = fn => (...args) => fn(...args)

const logger = {
  action: bind(console.log),
  debug: bind(console.log),
  dump: async () => {},
  error: bind(console.error),
  info: bind(console.log),
  localError: bind(console.error),
  localLog: bind(console.log),
  localWarn: bind(console.warn),
  sendLogsToService: async () => {},
  warn: bind(console.warn),
}

module.exports = logger
module.exports.default = logger
