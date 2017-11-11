// @flow
import * as React from 'react'
import * as I from 'immutable'
import {navigateAppend} from '../../actions/route-tree'
import EditTeamDescription, {type Props} from '.'
import {connect} from 'react-redux'
import {compose, withState, withPropsOnChange} from 'recompose'
import * as Creators from '../../actions/teams/creators'
import * as Constants from '../../constants/teams'

const mapDispatchToProps = (dispatch, props: Props) => ({
  onClose: () => dispatch(props.navigateUp()),
  onEditDescription: (description: string) => {
    dispatch(Creators.editTeamDescription(props.routeProps.get('teamname'), description))
    dispatch(props.navigateUp())
  },
  teamname: props.routeProps.get('teamname'),
})

const ConnectedEditTeamDescription: React.ComponentType<Props> = compose(
  withState('description', 'onChangeDescription', ''),
  connect(undefined, mapDispatchToProps)
)(EditTeamDescription)

export default ConnectedEditTeamDescription
