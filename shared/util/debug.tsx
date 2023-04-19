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
