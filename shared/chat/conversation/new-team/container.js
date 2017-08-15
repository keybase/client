// @flow
import NewTeamDialog from './'
import {connect} from 'react-redux'
import {compose, withState, withHandlers} from 'recompose'
import {navigateTo, navigateUp} from '../../../actions/route-tree'
import {chatTab} from '../../../constants/tabs'
import {createNewTeam, selectConversation} from '../../../actions/chat/creators'
import {getSelectedConversation} from '../../../constants/chat'

import type {RouteProps} from '../../../route-tree/render-route'
import type {TypedState} from '../../../constants/reducer'
import type {ConversationIDKey} from '../../../constants/chat'

type NewTeamDialogRouteProps = RouteProps<
  {
    conversationIDKey: ConversationIDKey,
    participants: string,
  },
  {}
>
type OwnProps = NewTeamDialogRouteProps & {}

const mapStateToProps = (state: TypedState) => ({
  conversationIDKey: getSelectedConversation(state),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  navToRootChat: () => dispatch(navigateTo([], [chatTab])),
  onBack: () => dispatch(navigateUp()),
  onCreateTeam: (conversationIDKey: ConversationIDKey, name: string) => {
    dispatch(createNewTeam(conversationIDKey, name))
    dispatch(selectConversation(null, true))
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('name', 'onNameChange', props => props.name),
  withHandlers({
    onSubmit: ({conversationIDKey, name, onCreateTeam}) => () => onCreateTeam(conversationIDKey, name),
  })
)(NewTeamDialog)
