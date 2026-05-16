import type * as React from 'react'
import type * as Styles from '@/styles'
import type * as T from '@/constants/types'

export type Props<I> = {
  items: Array<I>
  keyExtractor?: (item: I, idx: number) => string
  renderItem: (index: number, item: I) => React.ReactElement
  selectedIndex: number
  style?: Styles.StylesCrossPlatform
  suggestBotCommandsUpdateStatus?: T.RPCChat.UIBotCommandsUpdateStatusTyp
}
