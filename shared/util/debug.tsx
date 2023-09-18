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
export function createLoggingProxy<T extends object>(obj: T): T {
  console.log('[PROXY] installed!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  const proxy = new Proxy(obj, {
    get(target, propKey) {
      // @ts-ignore
      const originalMethod = target[propKey] as any
      if (typeof originalMethod === 'function') {
        return function (...args: any[]) {
          console.log(`[PROXY] Calling method: ${String(propKey)}`)
          console.log('[PROXY] Arguments:', args)
          // @ts-ignore
          const result = originalMethod.apply(this, args)
          console.log('[PROXY] Result:', result)
          return result
        }
      } else {
        return originalMethod
      }
    },
  })

  return proxy as T
}
