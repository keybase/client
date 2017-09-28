// @flow
import JoinTeamDialog from './'
import {connect} from 'react-redux'
import {compose, lifecycle, withState, withHandlers} from 'recompose'
import {
  joinTeam,
  setTeamJoinError,
  setTeamJoinSuccess,
  setTeamJoinSuccessBody,
} from '../../actions/teams/creators'
import {upperFirst} from 'lodash'

import type {TypedState} from '../../constants/reducer'

// TODO successText => successHeader; errorText => errorHeader
const mapStateToProps = (state: TypedState) => ({
  errorText: upperFirst(state.chat.teamJoinError),
  successBody: upperFirst(state.chat.teamJoinSuccessBody),
  successText: upperFirst(state.chat.teamJoinSuccess),
  // successBody: upperFirst(
  //   'We sent a request to chelseapiersoccer’s admins. We will notify you as soon as they let you in!'
  // ),
  // successText: upperFirst('Your request is on its way!'),
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
  _onSetTeamJoinSuccessBody: successBody => {
    dispatch(setTeamJoinSuccessBody(successBody))
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
      this.props._onSetTeamJoinSuccess('')
    },
  })
)(JoinTeamDialog)
