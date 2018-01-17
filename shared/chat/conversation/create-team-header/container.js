// @flow
import CreateTeamHeader from '.'
import {connect} from 'react-redux'
import {navigateAppend} from '../../../actions/route-tree'
import * as Constants from '../../../constants/chat'
import * as Types from '../../../constants/types/chat'
import type {TypedState} from '../../../constants/reducer'

import type {StateProps, DispatchProps} from './container'

const mapStateToProps = (state: TypedState) => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state) || ''
  if (!selectedConversationIDKey) {
    console.warn('no selected conversation in chat create team header')
  }

  return {
    selectedConversationIDKey,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onShowNewTeamDialog: (conversationIDKey: Types.ConversationIDKey) => {
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
  onShowNewTeamDialog: () => dispatchProps._onShowNewTeamDialog(stateProps.selectedConversationIDKey),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(CreateTeamHeader)
