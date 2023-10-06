import * as React from 'react'

export const useDebugLayout = __DEV__
  ? (cb?: () => void) => {
      const sizeRef = React.useRef([0, 0])
      return React.useCallback(
        (e: any) => {
          const height = e.nativeEvent.layout.height
          const width = e.nativeEvent.layout.width
          const [w, h] = sizeRef.current
          sizeRef.current = [width, height]
          if ((w && w !== width) || (h && h !== height)) {
            console.log('[DEBUG] useDebugLayout', {
              data: cb?.(),
              h,
              height,
              w,
              width,
            })
          }
        },
        [cb]
      )
    }
  : () => {
      return undefined
    }

// helper to debug method calls into an object
export function createLoggingProxy<T extends object>(
  obj: T,
  logMethods: boolean = true,
  logProps: boolean = false
): T {
  console.log('[PROXY] installed!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  const cache = new Map()
  const proxy = new Proxy(
    {},
    {
      get(_target, propKey) {
        if (cache.get(propKey)) {
          return cache.get(propKey)
        }
        // @ts-ignore
        const originalMethod = obj[propKey] as any
        if (typeof originalMethod === 'function') {
          if (logMethods) {
            const ret = function (...args: any[]) {
              console.log(`[PROXY] Calling method: ${String(propKey)}`)
              console.log('[PROXY] Arguments:', args)
              // @ts-ignore
              const result = originalMethod.apply(this, args)
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
