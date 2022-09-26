import {Platform, requireNativeComponent, View} from 'react-native'
import * as React from 'react'
import type * as Styles from '../styles'
import logger from '../logger'

const isSupported = Platform.OS === 'ios'
const IMPL = isSupported ? requireNativeComponent('DropView') : null

export type DropItems = Array<{originalPath?: string; content?: string}>
export type Props = {
  children?: React.ReactNode
  onDropped: (items: DropItems) => void
  style?: Styles.StylesCrossPlatform
}
const DropViewWrapperIOS = (p: Props) => {
  const {onDropped} = p
  const onDroppedCB = React.useCallback(
    e => {
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
        logger.warn('drop view error', e)
      }
    },
    [onDropped]
  )
  // @ts-ignore
  return <IMPL {...p} onDropped={onDroppedCB} />
}
export default isSupported ? DropViewWrapperIOS : View
