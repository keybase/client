import * as Container from '../../../../util/container'
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
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
const getConversationText = (conv: Types.ConversationMeta): string => {
  if (conv.teamType === 'big') {
    return conv.teamname + '#' + conv.channelname
  }
  if (conv.teamType === 'small') {
    return conv.teamname
  }
  return Constants.getRowParticipants(conv, '').join(',')
}

export default Container.connect(
  (state, ownProps: OwnProps) => ({
    _conv: state.chat2.metaMap.get(ownProps.selected),
  }),
  () => ({}),
  (stateProps, _, ownProps: OwnProps) => ({
    ...ownProps,
    selectedText: stateProps._conv ? getConversationText(stateProps._conv) : 'Choose a conversation',
  })
)(ChooseConversation)
