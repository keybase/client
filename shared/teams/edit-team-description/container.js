// @flow
import * as TeamsGen from '../../actions/teams-gen'
import EditTeamDescription from '.'
import {connect} from 'react-redux'
import {compose, withStateHandlers, withHandlers} from 'recompose'
import {getTeamPublicitySettings} from '../../constants/teams'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const teamname = routeProps.get('teamname')
  if (!teamname) {
    throw new Error('There was a problem loading the description page, please report this error.')
  }
  const origDescription = getTeamPublicitySettings(state, teamname).description
  return {
    origDescription,
    teamname,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, routeProps}) => ({
  _onSetDescription: (description: string) => {
    dispatch(TeamsGen.createEditTeamDescription({teamname: routeProps.get('teamname'), description}))
    dispatch(navigateUp())
  },
  onClose: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
})

const ConnectedEditTeamDescription = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withStateHandlers(({origDescription}) => ({description: origDescription}), {
    onChangeDescription: () => description => ({description}),
  }),
  withHandlers({
    onSetDescription: ({description, _onSetDescription}) => () => _onSetDescription(description),
  })
)(EditTeamDescription)

export default ConnectedEditTeamDescription
