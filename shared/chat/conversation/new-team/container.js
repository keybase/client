// @flow
import NewTeamDialog from './'
import {connect} from 'react-redux'
import {compose, withState, withHandlers} from 'recompose'
import {createNewTeamFromConversation, selectConversation} from '../../../actions/chat/creators'

import type {TypedState} from '../../../constants/reducer'
import type {ConversationIDKey} from '../../../constants/chat'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  conversationIDKey: routeProps.conversationIDKey,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  _onCreateNewTeamFromConversation: (conversationIDKey: ConversationIDKey, name: string) => {
    dispatch(createNewTeamFromConversation(conversationIDKey, name))
    dispatch(selectConversation(null, true))
  },
  onBack: () => dispatch(navigateUp()),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('name', 'onNameChange', ''),
  withHandlers({
    onSubmit: ({conversationIDKey, name, _onCreateNewTeamFromConversation}) => () =>
      _onCreateNewTeamFromConversation(conversationIDKey, name),
  })
)(NewTeamDialog)
