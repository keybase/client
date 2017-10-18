// @flow
import NewTeamDialog from '../teams/new-team'
import {connect} from 'react-redux'
import {compose, withState, withHandlers} from 'recompose'
import {type TypedState} from '../constants/reducer'
import {createNewTeamFromConversation} from '../actions/teams/creators'
import {upperFirst} from 'lodash'

const mapStateToProps = (state: TypedState) => ({
  errorText: upperFirst(state.chat.teamCreationError),
  pending: state.chat.teamCreationPending,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  _onCreateNewTeam: name => {
    dispatch(createNewTeamFromConversation(routeProps.get('conversationIDKey'), name))
  },
  onBack: () => dispatch(navigateUp()),
})

const NewTeamDialogFromChat = compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('name', 'onNameChange', ''),
  withHandlers({
    onSubmit: ({name, _onCreateNewTeam}) => () => _onCreateNewTeam(name),
  })
)(NewTeamDialog)

export default NewTeamDialogFromChat
