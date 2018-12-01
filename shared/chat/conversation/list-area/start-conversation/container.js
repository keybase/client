// @flow
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as WaitingConstants from '../../../../constants/waiting'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import StartConversation from '.'
import {connect} from '../../../../util/container'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
|}

const mapStateToProps = (state, {conversationIDKey}) => ({
  _meta: Constants.getMeta(state, conversationIDKey),
  isError: state.chat2.pendingStatus === 'failed',
  isLoading: WaitingConstants.anyWaiting(state, Constants.waitingKeyCreating),
  showAddParticipants: state.chat2.pendingMode === 'searchingForUsers',
})

const mapDispatchToProps = dispatch => ({
  onStart: (participants: Array<string>) => dispatch(Chat2Gen.createCreateConversation({participants})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const participants = stateProps._meta.participants.toArray()
  let str
  if (participants.length === 2) {
    str = `${participants[0]} and ${participants[1]}`
  } else {
    str = participants.join(', ')
  }
  return {
    isError: stateProps.isError,
    isLoading: stateProps.isLoading,
    onStart: () => dispatchProps.onStart(participants),
    participants: str,
    showAddParticipants: stateProps.showAddParticipants,
  }
}

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(StartConversation)
