import logger from '@/logger'
import {errorKind} from './errors'

const logFailure = (logExtra: string, e: unknown) => {
  // A cancelled call (a switch, a lost link, a dispose) is not a failure of the wrapped work
  const kind = errorKind(e)
  if (kind?.type === 'cancelled') {
    logger.info('Cancelled wrapped call', logExtra, kind.reason)
  } else if (__DEV__) {
    logger.error('Error in wrapped call', logExtra, e)
  } else {
    logger.error('Error in wrapped call', logExtra)
  }
}

export function wrapErrors<T extends (...args: any[]) => any>(f: T, logExtra: string = ''): T {
  return ((...p: Parameters<T>): ReturnType<T> => {
    try {
      const result = f(...p) as unknown
      if (result instanceof Promise) {
         
        return result.catch((e: unknown) => {
          logFailure(logExtra, e)
          throw e
        }) as ReturnType<T>
      }
       
      return result as ReturnType<T>
    } catch (e) {
      logFailure(logExtra, e)
      throw e
    }
  }) as T
}
