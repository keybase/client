import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import CreateTeamNotice from '.'
import {connect} from '../../../../util/container'

type OwnProps = {}

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
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey}, selected: 'chatShowNewTeamDialog'}],
      })
    )
  },
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => ({
  onShowNewTeamDialog: () => dispatchProps._onShowNewTeamDialog(stateProps.selectedConversationIDKey),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(CreateTeamNotice)
