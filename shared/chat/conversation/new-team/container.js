// @flow
import NewTeamDialog from './'
import {connect} from 'react-redux'
import {compose, withState, withHandlers} from 'recompose'
import {navigateTo} from '../../../actions/route-tree'
import {chatTab} from '../../../constants/tabs'
import {createNewTeamFromConversation, selectConversation} from '../../../actions/chat/creators'
import {getSelectedConversation} from '../../../constants/chat'

import type {TypedState} from '../../../constants/reducer'
import type {ConversationIDKey} from '../../../constants/chat'

const mapStateToProps = (state: TypedState) => ({
  conversationIDKey: getSelectedConversation(state),
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  navToRootChat: () => dispatch(navigateTo([], [chatTab])),
  onBack: () => dispatch(navigateUp()),
  onCreateTeam: (conversationIDKey: ConversationIDKey, name: string) => {
    dispatch(createNewTeamFromConversation(conversationIDKey, name))
    dispatch(selectConversation(null, true))
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('name', 'onNameChange', ''),
  withHandlers({
    onSubmit: ({conversationIDKey, name, onCreateTeam}) => () => onCreateTeam(conversationIDKey, name),
  })
)(NewTeamDialog)
