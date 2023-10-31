import * as React from 'react'
import {type LayoutChangeEvent, View, Pressable, Text} from 'react-native'

const ENABLE_UNMOUNT_ALL = __DEV__ && (false as boolean)

const UnmountAll = ({setShow}: {setShow: React.Dispatch<React.SetStateAction<boolean>>}) => {
  return (
    <View
      style={{
        backgroundColor: 'red',
        height: 40,
        left: 0,
        position: 'absolute',
        top: 20,
        width: 100,
        zIndex: 999,
      }}
    >
      <Pressable
        onPress={() => {
          setShow(s => !s)
        }}
      >
        <Text>Swap All</Text>
      </Pressable>
    </View>
  )
}
export const useUnmountAll = ENABLE_UNMOUNT_ALL
  ? () => {
      const [show, setShow] = React.useState(true)

      // clear debug globals

      setTimeout(() => {
        DEBUGmadeEngine = undefined
        DEBUGStore = undefined
        DEBUGEngine = undefined
        DEBUGLoaded = undefined
        KBCONSTANTS = undefined
        DEBUGNavigator = undefined
        DEBUGRouter2 = undefined
      }, 1000)

      const unmountAll = <UnmountAll setShow={setShow} />
      return {show, unmountAll}
    }
  : () => {
      return {show: true, unmountAll: null}
    }

export const useDebugLayout = __DEV__
  ? (cb?: () => void) => {
      const sizeRef = React.useRef([0 as number, 0 as number] as const)
      return React.useCallback(
        (e: LayoutChangeEvent) => {
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
