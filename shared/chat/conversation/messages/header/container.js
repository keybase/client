// @flow
import * as Constants from '../../../../constants/chat'
import Header from '.'
import {connect, compose, type TypedState} from '../../../../util/container'
import {commonConversationMembersType} from '../../../../constants/types/rpc-chat-gen'
import {type OwnProps} from './container'

const mapStateToProps = (state: TypedState, {messageKey}: OwnProps) => {
  const conversationState = Constants.getSelectedConversationStates(state)
  const moreToLoad = conversationState && conversationState.get('moreToLoad')
  const inbox = Constants.getSelectedInbox(state)

  // If it's a multi-user chat that isn't a team, offer to make a new team.
  const showTeamOffer =
    inbox && inbox.membersType !== commonConversationMembersType.team && inbox.get('participants').count() > 2

  return {
    moreToLoad,
    showTeamOffer,
  }
}

export default compose(connect(mapStateToProps, () => ({})))(Header)
