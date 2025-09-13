import DropView, {type DropItems} from './DropViewViewNativeComponent'
import {Platform, View, type ViewStyle} from 'react-native'
import * as React from 'react'

export type Props = {
  children?: React.ReactNode
  onDropped: (items: DropItems) => void
  style?: ViewStyle
}

const isSupported = Platform.OS === 'ios'
const DropViewWrapper = (p: Props) => {
  const {onDropped} = p
  const onDroppedCB = onDropped
  /*
  const onDroppedCB = React.useCallback(
    (e: any) => {
      try {
        const manifest = e.nativeEvent.manifest as DropItems
        const cleanedUp = manifest.reduce((arr, item) => {
          if (item.originalPath || item.content) {
            arr.push(item)
          }
          return arr
        }, new Array<DropItems[0]>())
        onDropped(cleanedUp)
      } catch (e) {
        console.log('drop view error', e)
      }
    },
    [onDropped]
  )
    */
  return <DropView {...p} onDropped={onDroppedCB} />
}
export default isSupported ? DropViewWrapper : View
export const DropViewView = DropViewWrapper

export type {DropItems} from './DropViewViewNativeComponent'
