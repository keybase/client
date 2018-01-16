// @noflow
import * as TeamsGen from '../actions/teams-gen'
import NewTeamDialog from '../teams/new-team'
import {connect} from 'react-redux'
import {compose, withState, withHandlers} from 'recompose'
import {type TypedState} from '../constants/reducer'
import upperFirst from 'lodash/upperFirst'
import {lifecycle} from '../util/container'

const mapStateToProps = (state: TypedState) => ({
  errorText: upperFirst(state.chat.teamCreationError),
  pending: state.chat.teamCreationPending,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  _onCreateNewTeam: (teamname: string) => {
    dispatch(
      TeamsGen.createCreateNewTeamFromConversation({
        conversationIDKey: routeProps.get('conversationIDKey'),
        teamname,
      })
    )
  },
  _onSetTeamCreationError: (error: string) => {
    dispatch(TeamsGen.createSetTeamCreationError({error}))
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
