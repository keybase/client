// @flow
import * as Types from '../../../constants/types/chat2'
import CreateTeamHeader from '.'
import {connect, type TypedState, type Dispatch} from '../../../util/container'
import {navigateAppend} from '../../../actions/route-tree'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey,
}
const mapStateToProps = (state: TypedState, {conversationIDKey}: OwnProps) => ({
  conversationIDKey,
})

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

const mergeProps = (stateProps, dispatchProps) => ({
  onShowNewTeamDialog: () => dispatchProps._onShowNewTeamDialog(stateProps.conversationIDKey),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(CreateTeamHeader)
