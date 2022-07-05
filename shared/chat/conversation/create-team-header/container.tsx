import * as Types from '../../../constants/types/chat2'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import CreateTeamHeader from '.'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

const Connected = Container.connect(
  (_, {conversationIDKey}: OwnProps) => ({conversationIDKey}),
  dispatch => ({
    _onShowNewTeamDialog: (conversationIDKey: Types.ConversationIDKey) => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {conversationIDKey}, selected: 'chatShowNewTeamDialog'}],
        })
      )
    },
  }),
  (stateProps, dispatchProps) => ({
    onShowNewTeamDialog: () => dispatchProps._onShowNewTeamDialog(stateProps.conversationIDKey),
  })
)(CreateTeamHeader)
export default Connected
