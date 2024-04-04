import type Logger from '@/logger'
export const ENABLE_F5_REMOUNTS = __DEV__ && (false as boolean)

const debuggerOnWrapError = false as boolean

const debugClearCBs = new Array<() => void>()
const debugUnClearCBs = new Array<() => void>()

export const registerDebugUnClear = (cb: () => void) => {
  debugUnClearCBs.push(cb)
}
export const registerDebugClear = (cb: () => void) => {
  debugClearCBs.push(cb)
}
export const debugClear = __DEV__
  ? () => {
      for (const cb of debugClearCBs) {
        cb()
      }
    }
  : () => {}
export const debugUnClear = __DEV__
  ? () => {
      for (const cb of debugUnClearCBs) {
        cb()
      }
    }
  : () => {}

// helper to debug method calls into an object
export function createLoggingProxy<T extends {[key: string]: unknown}>(
  obj: T,
  logMethods: boolean = true,
  logProps: boolean = false
): T {
  console.log('[PROXY] installed!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  const cache = new Map<string, unknown>()
  const proxy = new Proxy(
    {},
    {
      get(_target, propKey: string) {
        if (cache.get(propKey)) {
          return cache.get(propKey)
        }
        const originalMethod = obj[propKey] as any as unknown
        if (typeof originalMethod === 'function') {
          if (logMethods) {
            const ret = function (...args: any[]) {
              console.log(`[PROXY] Calling method: ${String(propKey)}`)
              console.log('[PROXY] Arguments:', args)
              const result = originalMethod.apply(obj, args) as unknown
              console.log('[PROXY] Result:', result)
              return result
            }
            cache.set(propKey, ret)
            return ret
          } else {
            return originalMethod
          }
        } else {
          if (logProps) {
            console.log(`[PROXY] props access: ${String(propKey)}`)
          }
          return originalMethod
        }
      },
    }
  )

  return proxy as T
}

const maybeDebugger = () => {
  if (debuggerOnWrapError) {
    // eslint-disable-next-line no-debugger
    debugger
  }
}

export function wrapErrors<T extends (...args: Array<any>) => any>(f: T, logExtra: string = ''): T {
  return ((...p: Parameters<T>): ReturnType<T> => {
    try {
      const result = f(...p) as unknown
      if (result instanceof Promise) {
        return result.catch((e: unknown) => {
          const {default: logger} = require('@/logger') as {default: typeof Logger}
          if (__DEV__) {
            logger.error('Error in wrapped call', logExtra, e)
            maybeDebugger()
          } else {
            logger.error('Error in wrapped call', logExtra)
          }
          throw e
        }) as ReturnType<T>
      }
      return result as ReturnType<T>
    } catch (e) {
      const {default: logger} = require('@/logger') as {default: typeof Logger}
      if (__DEV__) {
        logger.error('Error in wrapped call', logExtra, e)
        maybeDebugger()
      } else {
        logger.error('Error in wrapped call', logExtra)
      }
      throw e
    }
  }) as T
}
