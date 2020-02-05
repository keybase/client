import * as Container from '../../../../util/container'
import * as Types from '../../../../constants/types/chat2'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Styles from '../../../../styles'
import ChooseConversation from './choose-conversation'

type OwnProps = {
  dropdownButtonStyle?: Styles.StylesCrossPlatform
  filter?: string
  onSelect: (conversationIDKey: Types.ConversationIDKey) => void
  onSetFilter?: (filter: string) => void
  selected: Types.ConversationIDKey
}
//
// Temporary until we make proper component for dropdown button content.
export default Container.connect(
  state => ({_inboxLayout: state.chat2.inboxLayout}),
  () => ({}),
  (stateProps, _, ownProps: OwnProps) => {
    let selectedText: string = ''

    const {_inboxLayout} = stateProps
    if (_inboxLayout) {
      const st = _inboxLayout.smallTeams
      if (st) {
        const found = st.find(s => s.convID === ownProps.selected)
        if (found) {
          selectedText = found.name
        }
      }

      const bt = _inboxLayout.bigTeams
      if (!selectedText && bt) {
        const found = bt.find(
          b => b.state === RPCChatTypes.UIInboxBigTeamRowTyp.channel && b.channel.convID === ownProps.selected
        )
        if (found && found.state === RPCChatTypes.UIInboxBigTeamRowTyp.channel) {
          selectedText = `${found.channel.teamname}#${found.channel.channelname}`
        }
      }
    }

    if (!selectedText) {
      selectedText = 'Choose a conversation'
    }

    return {
      ...ownProps,
      selectedText,
    }
  }
)(ChooseConversation)
