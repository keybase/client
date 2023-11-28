import type * as React from 'react'
import type * as Styles from '../../../../styles'
import type * as T from '@/constants/types'

export type Props = {
  items: Array<any>
  keyExtractor?: (item: any, idx: number) => string
  renderItem: (index: number, item: any) => React.ReactElement
  selectedIndex: number
  style?: Styles.StylesCrossPlatform
  // likely doesn't belong here
  suggestBotCommandsUpdateStatus?: T.RPCChat.UIBotCommandsUpdateStatusTyp
}

declare const SuggestionList: (p: Props) => React.ReactNode
export default SuggestionList
