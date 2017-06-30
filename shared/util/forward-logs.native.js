// @flow
import logger from './logger'
import {forwardLogs} from '../local-debug'

let forwarded = false

const localLog = window.console.log.bind(window.console)
const localWarn = window.console.warn.bind(window.console)
const localError = window.console.error.bind(window.console)

function setupSource() {
  if (!forwardLogs) {
    return
  }

  if (forwarded) {
    return
  }
  forwarded = true

  const makeOverride = method => {
    return function(a1, a2, a3, a4, a5) {
      if (arguments.length === 1) {
        localLog(a1)
        logger[method](a1)
      } else if (arguments.length === 2) {
        localLog(a1, a2)
        logger[method](a1, a2)
      } else if (arguments.length === 3) {
        localLog(a1, a2, a3)
        logger[method](a1, a2, a3)
      } else if (arguments.length === 4) {
        localLog(a1, a2, a3, a4)
        logger[method](a1, a2, a3, a4)
      } else if (arguments.length === 5) {
        localLog(a1, a2, a3, a4, a5)
        logger[method](a1, a2, a3, a4, a5)
      }
    }
  }

  window.console.log = makeOverride('info')
  window.console.warn = makeOverride('warn')
  window.console.error = makeOverride('error')
}

export {setupSource, localLog, localWarn, localError}
