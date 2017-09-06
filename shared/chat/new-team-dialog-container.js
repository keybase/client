// @flow
import NewTeamDialog from '../teams/new-team'
import {connect} from 'react-redux'
import {compose, withState, withHandlers} from 'recompose'
import {createNewTeamFromConversation} from '../actions/teams/creators'
import {selectConversation} from '../actions/chat/creators'

import type {TypedState} from '../constants/reducer'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  _conversationIDKey: routeProps.conversationIDKey,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  _onCreateNewTeam: (conversationIDKey, name) => {
    dispatch(createNewTeamFromConversation(conversationIDKey, name))
    dispatch(selectConversation(null, true))
  },
  onBack: () => dispatch(navigateUp()),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('name', 'onNameChange', ''),
  withHandlers({
    onSubmit: ({_conversationIDKey, name, _onCreateNewTeam}) => () =>
      _onCreateNewTeam(_conversationIDKey, name),
  })
)(NewTeamDialog)
