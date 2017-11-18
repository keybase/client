// @flow
import {forwardLogs, enableActionLogging, immediateStateLogging} from '../local-debug'
import {noPayloadTransformer} from '../constants/types/flux'
import {setupLogger, immutableToJS} from '../util/periodic-logger'
import logger from '../logger'

function makeActionToLog(action, oldState) {
  if (action.logTransformer) {
    try {
      return action.logTransformer(action, oldState)
    } catch (e) {
      console.warn('Action logger error', e)
    }
  }
  return noPayloadTransformer(action, oldState)
}

const transform = (o: Array<any>) => {
  return [JSON.stringify(immutableToJS(o), null, 2)]
}

// const logger = enableActionLogging
//   ? setupLogger('actionLogger', 100, immediateStateLogging, transform, 50, true)
//   : {log: (...args: any) => {}}

export const actionLogger = (store: any) => (next: any) => (action: any) => {
  const oldState = store.getState()
  const actionToLog = makeActionToLog(action, oldState)

  const log1 = [`type: ${action.type}: `, actionToLog]
  logger.action(...log1)

  return next(action)
}
