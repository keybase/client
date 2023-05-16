import * as React from 'react'
import * as Styles from '../../styles'
import * as Constants from '../../constants/chat2'

export type SizingType = 'chatVideo'
// we want to fix the image / video size to avoid thrashing but its hard to sync
// the actual space with all the padding so instead we measure it once per type
// if the value is 0 here we'll pass an onLayout that can be used to set the value
const maxWidths = new Map([['chatVideo', Styles.isMobile ? 0 : 320]])

export const useSizing = (type: SizingType, srcWidth: number, srcHeight: number, maxHeight: number) => {
  const [maxWidth, setMaxWidth] = React.useState(maxWidths.get(type) ?? 0)
  const _onLayout = React.useCallback(
    (e: any) => {
      const w: number = e.nativeEvent.layout.width ?? 0
      maxWidths.set(type, w)
      setMaxWidth(w)
    },
    [setMaxWidth, type]
  )
  const onLayout = maxWidth === 0 ? _onLayout : undefined

  let width: number | string = '100%'
  let height: number | string = 'auto'
  if (maxWidth !== 0) {
    const size = Constants.clampImageSize(srcWidth, srcHeight, maxWidth, maxHeight)
    width = size.width
    height = size.height
  }

  return {height, onLayout, width}
}
