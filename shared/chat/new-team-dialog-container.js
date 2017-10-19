// @flow
import NewTeamDialog from '../teams/new-team'
import {connect} from 'react-redux'
import {compose, withState, withHandlers} from 'recompose'
import {type TypedState} from '../constants/reducer'
import {createNewTeamFromConversation, setTeamCreationError} from '../actions/teams/creators'
import {upperFirst} from 'lodash'
import {lifecycle} from '../util/container'

const mapStateToProps = (state: TypedState) => ({
  errorText: upperFirst(state.chat.teamCreationError),
  pending: state.chat.teamCreationPending,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  _onCreateNewTeam: name => {
    dispatch(createNewTeamFromConversation(routeProps.get('conversationIDKey'), name))
  },
  _onSetTeamCreationError: error => {
    dispatch(setTeamCreationError(error))
  },
  onBack: () => dispatch(navigateUp()),
})

const NewTeamDialogFromChat = compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('name', 'onNameChange', ''),
  withHandlers({
    onSubmit: ({name, _onCreateNewTeam}) => () => _onCreateNewTeam(name),
  }),
  lifecycle({
    componentDidMount: function() {
      this.props._onSetTeamCreationError('')
    },
  })
)(NewTeamDialog)

export default NewTeamDialogFromChat
