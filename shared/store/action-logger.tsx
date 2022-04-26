import transformActionForLog from '../logger/action-transformer'
import logger from '../logger'
import type {TypedDispatch, TypedActions} from 'util/container'

export const actionLogger = () => (next: TypedDispatch) => (action: TypedActions) => {
  try {
    const output = transformActionForLog(action)
    if (output) {
      const log1 = [`type: ${action.type}: `, action.payload] // TEMPoutput]
      logger.action(...log1)
    }
  } catch (e) {
    logger.action(`Error logging action: ${action.type || 'unknown type'}`)
  }

  return next(action)
}
