import DropView, {type Props, type DropItems} from './DropViewViewNativeComponent'
import {Platform, View} from 'react-native'
import * as React from 'react'

const isSupported = Platform.OS === 'ios'
const DropViewWrapper = (p: Props) => {
  const {onDropped} = p
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
  return <DropView {...p} onDropped={onDroppedCB} />
}
export default isSupported ? DropViewWrapper : View

export type {DropItems} from './DropViewViewNativeComponent'
