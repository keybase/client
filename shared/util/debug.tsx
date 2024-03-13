export const ENABLE_F5_REMOUNTS = __DEV__ && (true as boolean)

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
