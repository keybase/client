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

  window.console.log = (a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) => {
    localLog(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10)
    logger.info(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10)
  }

  window.console.warn = (a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) => {
    localWarn(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10)
    logger.warn(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10)
  }

  window.console.error = (a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) => {
    localError(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10)
    logger.error(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10)
  }
}

export {setupSource, localLog, localWarn, localError}
