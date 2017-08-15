// @flow
import * as Constants from '../../../../constants/chat'
import CreateTeamNotice from '.'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import {navigateAppend} from '../../../../actions/route-tree'

import type {TypedState} from '../../../../constants/reducer'
import type {StateProps, DispatchProps} from './container'

const mapStateToProps = (state: TypedState) => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  if (!selectedConversationIDKey) {
    throw new Error('no selected conversation')
  }

  return {
    selectedConversationIDKey,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onShowNewTeamDialog: (conversationIDKey: Constants.ConversationIDKey) => {
    dispatch(
      navigateAppend([
        {
          props: {conversationIDKey},
          selected: 'showNewTeamDialog',
        },
      ])
    )
  },
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => ({
  onShowNewTeamDialog: () => dispatchProps.onShowNewTeamDialog(stateProps.selectedConversationIDKey),
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps))(CreateTeamNotice)
