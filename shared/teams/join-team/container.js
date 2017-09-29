// @flow
import JoinTeamDialog from './'
import {connect} from 'react-redux'
import {compose, lifecycle, withState, withHandlers} from 'recompose'
import {joinTeam, setTeamJoinError, setTeamJoinSuccess} from '../../actions/teams/creators'
import {upperFirst} from 'lodash'

import type {TypedState} from '../../constants/reducer'

// TODO successText => successHeader; errorText => errorHeader
const mapStateToProps = (state: TypedState) => ({
  errorText: upperFirst(state.chat.teamJoinError),
  success: state.chat.teamJoinSuccess,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  _onJoinTeam: name => {
    dispatch(joinTeam(name))
  },
  _onSetTeamJoinError: error => {
    dispatch(setTeamJoinError(error))
  },
  _onSetTeamJoinSuccess: success => {
    dispatch(setTeamJoinSuccess(success))
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
      this.props._onSetTeamJoinSuccess(false)
    },
  })
)(JoinTeamDialog)
