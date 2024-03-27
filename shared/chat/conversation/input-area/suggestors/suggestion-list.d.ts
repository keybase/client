import type * as React from 'react'
import type * as Styles from '@/styles'
import type * as T from '@/constants/types'

export type Props<I> = {
  // TODO fix this type
  items: Array<I>
  keyExtractor?: (item: I, idx: number) => string
  renderItem: (index: number, item: I) => React.ReactElement
  selectedIndex: number
  style?: Styles.StylesCrossPlatform
  // likely doesn't belong here
  suggestBotCommandsUpdateStatus?: T.RPCChat.UIBotCommandsUpdateStatusTyp
}

declare function SuggestionList<I>(p: Props<I>): React.ReactNode
export default SuggestionList
