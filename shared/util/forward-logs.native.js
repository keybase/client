// @flow
import logger from './logger'
import {forwardLogs} from '../local-debug'

let forwarded = false

const localLog = window.console.log.bind(window.console)
const localWarn = window.console.warn.bind(window.console)
const localError = window.console.error.bind(window.console)

function setupSource () {
  if (!forwardLogs) {
    return
  }

  if (forwarded) {
    return
  }
  forwarded = true

  window.console.log = (...args) => {
    localLog(...args)
    logger.info(args.join(', '))
  }

  window.console.warn = (...args) => {
    localWarn(...args)
    logger.warn(args.join(', '))
  }

  window.console.error = (...args) => {
    if (__DEV__) {
      localError(...args)
    } else {
      localWarn(...args)
    }
    logger.error(args.join(', '))
  }
}

export {
  setupSource,
  localLog,
  localWarn,
  localError,
}
