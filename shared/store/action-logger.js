// @flow
import transformActionForLog from '../logger/action-transformer'
import logger from '../logger'

export const actionLogger = (store: any) => (next: any) => (action: any) => {
  try {
    const log1 = [`type: ${action.type}: `, transformActionForLog(action, store.getState())]
    logger.action(...log1)
  } catch (e) {
    logger.action(`Error logging action: ${action.type || 'unknown type'}`)
  }

  return next(action)
}
