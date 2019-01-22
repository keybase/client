// @flow
import {namedConnect} from '../../util/container'
import * as Types from '../../constants/types/chat2'
import * as Constants from '../../constants/chat2'
import * as Styles from '../../styles'
import ChooseConversation from './choose-conversation'

// TODO: this is temporary until we make proper stuff for in-button component
// for selected conversation.

type OwnProps = {|
  dropdownButtonStyle?: ?Styles.StylesCrossPlatform,
  filter?: string,
  onSelect: (conversationIDKey: Types.ConversationIDKey) => void,
  onSetFilter?: (filter: string) => void,
  selected: Types.ConversationIDKey,
|}

const mapStateToProps = (state, ownProps) => ({
  _conv: state.chat2.metaMap.get(ownProps.selected),
})

const mapDispatchToProps = () => ({})

// Temporary until we make proper component for dropdown button content.
const getConversationText = (conv: Types.ConversationMeta): string => {
  if (conv.teamType === 'big') {
    return conv.teamname + '#' + conv.channelname
  }
  if (conv.teamType === 'small') {
    return conv.teamname
  }
  return Constants.getRowParticipants(conv, '')
    .toArray()
    .join(',')
}

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  selectedText: stateProps._conv ? getConversationText(stateProps._conv) : 'Choose a conversation',
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ChooseConversation'
)(ChooseConversation)
