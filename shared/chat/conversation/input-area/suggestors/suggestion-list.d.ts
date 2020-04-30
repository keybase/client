import * as React from 'react'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'

export type Props = {
  items: Array<string>
  keyExtractor?: (item: any) => string
  renderItem: (index: number, item: string) => React.ReactElement | null
  selectedIndex: number
  style?: Styles.StylesCrossPlatform
  suggestBotCommandsUpdateStatus?: RPCChatTypes.UIBotCommandsUpdateStatusTyp
}

export default class extends React.Component<Props> {}
