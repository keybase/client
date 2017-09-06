// @flow
import NewTeamDialog from '../teams/new-team'
import {connect} from 'react-redux'
import {compose, withState, withHandlers} from 'recompose'
import {createNewTeamFromConversation} from '../actions/teams/creators'
import {selectConversation, exitSearch} from '../actions/chat/creators'

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  _onCreateNewTeam: name => {
    dispatch(createNewTeamFromConversation(routeProps.conversationIDKey, name))
    dispatch(selectConversation(null, true))
    dispatch(exitSearch())
  },
  onBack: () => dispatch(navigateUp()),
})

export default compose(
  connect(null, mapDispatchToProps),
  withState('name', 'onNameChange', ''),
  withHandlers({
    onSubmit: ({name, _onCreateNewTeam}) => () => _onCreateNewTeam(name),
  })
)(NewTeamDialog)
