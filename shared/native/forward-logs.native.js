import logger from './logger'
import setupLocalLogs, {logLocal, warnLocal, errorLocal} from '../util/local-log'
import {forwardLogs} from '../local-debug'

let forwarded = false

export default function () {
  if (forwarded) {
    return
  }
  forwarded = true

  setupLocalLogs()

  if (!forwardLogs) {
    return
  }

  window.console.log = (...args) => { logLocal(...args); logger.info(args.join(', ')) }
  window.console.warn = (...args) => { warnLocal(...args); logger.info(args.join(', ')) }
  window.console.error = (...args) => { errorLocal(...args); logger.info(args.join(', ')) }
}
