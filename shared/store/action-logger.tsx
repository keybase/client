import transformActionForLog from '../logger/action-transformer'
import logger from '../logger'

export const actionLogger = (store: any) => (next: any) => (action: any) => {
  console.log('aaaa action log raw TODO REMOVE', action.type, action.payload)
  try {
    const output = transformActionForLog(action, store.getState())
    if (output) {
      const log1 = [`type: ${action.type}: `, output]
      logger.action(...log1)
    }
  } catch (e) {
    logger.action(`Error logging action: ${action.type || 'unknown type'}`)
  }

  return next(action)
}
