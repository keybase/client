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
  isLoading: WaitingConstants.anyWaiting(state, Constants.waitingKeyCreating),
  showAddParticipants: state.chat2.pendingMode === 'searchingForUsers',
  isError: state.chat2.pendingStatus === 'failed',
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
    isLoading: stateProps.isLoading,
    isError: stateProps.isError,
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
