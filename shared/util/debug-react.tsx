import * as React from 'react'
import {type LayoutChangeEvent, View, Pressable, Text} from 'react-native'
import {debugClear} from './debug'

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
        debugClear()
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
