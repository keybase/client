// @flow
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import CreateTeamNotice from '.'
import {connect} from '../../../../util/container'
import {navigateAppend} from '../../../../actions/route-tree'

type OwnProps = {||}

const mapStateToProps = state => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  if (!selectedConversationIDKey) {
    throw new Error('no selected conversation')
  }

  return {
    selectedConversationIDKey,
  }
}

const mapDispatchToProps = dispatch => ({
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

const mergeProps = (stateProps, dispatchProps) => ({
  onShowNewTeamDialog: () => dispatchProps._onShowNewTeamDialog(stateProps.selectedConversationIDKey),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(CreateTeamNotice)
