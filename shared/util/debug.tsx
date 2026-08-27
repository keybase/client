import logger from '@/logger'

export function wrapErrors<T extends (...args: any[]) => any>(f: T, logExtra: string = ''): T {
  return ((...p: Parameters<T>): ReturnType<T> => {
    try {
      const result = f(...p) as unknown
      if (result instanceof Promise) {
         
        return result.catch((e: unknown) => {
          if (__DEV__) {
            logger.error('Error in wrapped call', logExtra, e)
          } else {
            logger.error('Error in wrapped call', logExtra)
          }
          throw e
        }) as ReturnType<T>
      }
       
      return result as ReturnType<T>
    } catch (e) {
      if (__DEV__) {
        logger.error('Error in wrapped call', logExtra, e)
      } else {
        logger.error('Error in wrapped call', logExtra)
      }
      throw e
    }
  }) as T
}
