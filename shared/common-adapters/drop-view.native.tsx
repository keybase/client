import {requireNativeComponent} from 'react-native'
import * as React from 'react'
import type * as Styles from '../styles'
const IMPL = requireNativeComponent('DropView')

export type DropItems = Array<{originalPath: string}>
export type Props = {
  children?: React.ReactNode
  onDropped: (items: DropItems) => void
  style?: Styles.StylesCrossPlatform
}
const DropViewWrapper = (p: Props) => {
  const {onDropped} = p
  const onDroppedCB = React.useCallback(
    e => {
      const manifest = e.nativeEvent.manifest as DropItems
      const cleanedUp = manifest.reduce((arr, item) => {
        if (item?.originalPath) {
          arr.push(item)
        }
        return arr
      }, new Array<DropItems[0]>())
      onDropped(cleanedUp)
    },
    [onDropped]
  )
  // @ts-ignore
  return <IMPL {...p} onDropped={onDroppedCB} />
}
export default DropViewWrapper
