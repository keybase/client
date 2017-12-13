// @flow
import * as I from 'immutable'
import * as Constants from '../../../../constants/chat'
// import * as Types from '../../../../constants/types/chat'
import ResetUser from '.'
// import createCachedSelector from 're-reselect'
import {compose, connect} from '../../../../util/container'
// import {connect} from 'react-redux'
// import {navigateAppend, navigateTo} from '../../../../actions/route-tree'
// import {isMobile} from '../../../../constants/platform'
// import {createShowUserProfile} from '../../../../actions/profile-gen'
// import {createGetProfile} from '../../../../actions/tracker-gen'
// import {chatTab} from '../../../../constants/tabs'

// import type {TypedState} from '../../../../constants/reducer'
// import type {OwnProps} from './container'

const mapStateToProps = (state: TypedState, {messageKey}: OwnProps): * => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  const user = state.chat.inboxResetParticipants.get(selectedConversationIDKey, I.Set()).first()
  return {user}
}

const mapDispatchToProps = (dispatch: Dispatch) => ({})

const mergeProps = (stateProps, dispatchProps) => ({
  ...stateProps,
  ...dispatchProps,
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps))(ResetUser)
