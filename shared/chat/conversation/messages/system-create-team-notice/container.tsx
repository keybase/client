import * as Types from '../../../../constants/types/chat2'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import CreateTeamNotice from '.'
import {connect} from '../../../../util/container'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

export default connect(
  () => ({}),
  dispatch => ({
    _onShowNewTeamDialog: (conversationIDKey: Types.ConversationIDKey) => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {conversationIDKey}, selected: 'chatShowNewTeamDialog'}],
        })
      )
    },
  }),
  (_, dispatchProps, ownProps: OwnProps) => ({
    onShowNewTeamDialog: () => dispatchProps._onShowNewTeamDialog(ownProps.conversationIDKey),
  })
)(CreateTeamNotice)
