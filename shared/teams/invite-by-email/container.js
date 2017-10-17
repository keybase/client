// @flow
import {connect} from 'react-redux'
import * as Creators from '../../actions/teams/creators'
import InviteByEmail from '.'
import {HeaderHoc} from '../../common-adapters'
import {compose, withPropsOnChange} from 'recompose'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  name: routeProps.get('teamname'),
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  onClose: () => dispatch(navigateUp()),
  onInvite: (role: string) => {
    dispatch(Creators.addPeopleToTeam(routeProps.get('teamname'), role))
    dispatch(navigateUp())
    dispatch(Creators.getTeams())
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  compose(
    withPropsOnChange(['onExitSearch'], props => ({
      onCancel: () => props.onClose(),
      title: 'Invite by email',
    })),
    HeaderHoc
  )
)(InviteByEmail)
