// @flow
import * as React from 'react'
import EditTeamDescription, {type Props} from '.'
import {connect} from 'react-redux'
import {compose, withState, withHandlers} from 'recompose'
import * as Creators from '../../actions/teams/creators'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const teamname = routeProps.get('teamname')
  if (!teamname) {
    throw new Error('There was a problem loading the description page, please report this error.')
  }
  const origDescription = state.entities.getIn(['teams', 'teamNameToPublicitySettings', teamname, 'description'], '')
  return {
    origDescription,
    teamname,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, routeProps}) => ({
  onClose: () => dispatch(navigateUp()),
  _onSetDescription: (description: string) => {
    dispatch(Creators.editTeamDescription(routeProps.get('teamname'), description))
    dispatch(navigateUp())
  },
})

const ConnectedEditTeamDescription: React.ComponentType<Props> = compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('description', 'onChangeDescription', props => props.origDescription),
  withHandlers({
    onSetDescription: ({description, _onSetDescription}) => () => _onSetDescription(description),
  })
)(EditTeamDescription)

export default ConnectedEditTeamDescription
