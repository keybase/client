// @flow
import {noPayloadTransformer} from '../constants/types/flux'
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

export const actionLogger = (store: any) => (next: any) => (action: any) => {
  const oldState = store.getState()
  const actionToLog = makeActionToLog(action, oldState)

  const log1 = [`type: ${action.type}: `, actionToLog]
  logger.action(...log1)

  return next(action)
}
