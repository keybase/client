import * as React from 'react'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'

export type Props = {
  items: Array<any>
  keyExtractor?: (item: any) => string
  renderItem: (index: number, item: any) => React.ReactElement
  selectedIndex: number
  style?: Styles.StylesCrossPlatform
  // likely doesn't belong here
  suggestBotCommandsUpdateStatus?: RPCChatTypes.UIBotCommandsUpdateStatusTyp
}

export default class extends React.Component<Props> {}
