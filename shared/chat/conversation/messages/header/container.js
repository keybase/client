// @flow
import * as Constants from '../../../../constants/chat'
import Header from '.'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import {CommonConversationMembersType} from '../../../../constants/types/flow-types-chat'

import type {TypedState} from '../../../../constants/reducer'
import type {OwnProps} from './container'

const mapStateToProps = (state: TypedState, {messageKey}: OwnProps) => {
  const conversationState = Constants.getSelectedConversationStates(state)
  const moreToLoad = conversationState && conversationState.get('moreToLoad')
  const inbox = Constants.getSelectedInbox(state)

  // If it's a multi-user chat that isn't a team, offer to make a new team.
  const showTeamOffer =
    inbox &&
    inbox.info &&
    inbox.membersType !== CommonConversationMembersType.team &&
    inbox.get('participants').size > 2

  return {
    showTeamOffer,
    moreToLoad,
  }
}

export default compose(connect(mapStateToProps, () => ({})))(Header)
