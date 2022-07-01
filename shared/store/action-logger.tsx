import transformActionForLog from '../logger/action-transformer'
import logger from '../logger'
import type {TypedDispatch, TypedActions} from 'util/container'

const TEMP_FULL_ACTION_OUTPUT = __DEV__ && false
if (TEMP_FULL_ACTION_OUTPUT) {
  for (let i = 0; i < 10; ++i) {
    console.error('TEMP_FULL_ACTION_OUTPUT enabled in action logger!')
  }
}

export const actionLogger = () => (next: TypedDispatch) => (action: TypedActions) => {
  try {
    const output = TEMP_FULL_ACTION_OUTPUT ? action.payload : transformActionForLog(action)
    if (output) {
      const log1 = [`type: ${action.type}: `, output]
      logger.action(...log1)
    }
  } catch (e) {
    logger.action(`Error logging action: ${action.type || 'unknown type'}`)
  }

  return next(action)
}
