// @flow
import * as Types from '../../../constants/types/chat2'
import CreateTeamHeader from '.'
import {connect} from '../../../util/container'
import {navigateAppend} from '../../../actions/route-tree'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey,
}
const mapStateToProps = (state, {conversationIDKey}: OwnProps) => ({
  conversationIDKey,
})

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
  onShowNewTeamDialog: () => dispatchProps._onShowNewTeamDialog(stateProps.conversationIDKey),
})

const Connected = connect<OwnProps, _,_,_,_>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(CreateTeamHeader)
export default Connected
