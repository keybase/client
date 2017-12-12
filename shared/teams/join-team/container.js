// @flow
import * as TeamsGen from '../../actions/teams-gen'
import JoinTeamDialog from '.'
import {connect} from 'react-redux'
import {compose, lifecycle, withState, withHandlers} from 'recompose'
import upperFirst from 'lodash/upperFirst'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState) => ({
  errorText: upperFirst(state.chat.teamJoinError),
  success: state.chat.teamJoinSuccess,
  successTeamName: state.chat.teamJoinSuccessTeamName,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  _onJoinTeam: (teamname: string) => {
    dispatch(TeamsGen.createJoinTeam({teamname}))
  },
  _onSetTeamJoinError: error => {
    dispatch(TeamsGen.createSetTeamJoinError({error}))
  },
  _onSetTeamJoinSuccess: (success: boolean, teamname: string) => {
    dispatch(TeamsGen.createSetTeamJoinSuccess({success, teamname}))
  },
  onBack: () => dispatch(navigateUp()),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('name', 'onNameChange', ''),
  withHandlers({
    onSubmit: ({name, _onJoinTeam}) => () => _onJoinTeam(name),
  }),
  lifecycle({
    componentDidMount: function() {
      this.props._onSetTeamJoinError('')
      this.props._onSetTeamJoinSuccess(false, null)
    },
  })
)(JoinTeamDialog)
