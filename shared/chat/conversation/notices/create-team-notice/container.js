// @flow
import * as Constants from '../../../../constants/chat'
import * as Creators from '../../../../actions/chat/creators'
import CreateTeamNotice from '.'
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
  _onShowNewTeamDialog: (conversationIDKey: Constants.ConversationIDKey) => {
    dispatch(
      navigateAppend([
        {
          props: {
            onCreateNewTeam: name => {
              dispatch(Creators.createNewTeamFromConversation(conversationIDKey, name))
              dispatch(Creators.selectConversation(null, true))
            },
          },
          selected: 'showNewTeamDialog',
        },
      ])
    )
  },
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => ({
  onShowNewTeamDialog: () => dispatchProps._onShowNewTeamDialog(stateProps.selectedConversationIDKey),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(CreateTeamNotice)
