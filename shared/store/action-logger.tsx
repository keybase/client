import transformActionForLog from '../logger/action-transformer'
import logger from '../logger'

export const actionLogger = (store: any) => (next: any) => (action: any) => {
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
