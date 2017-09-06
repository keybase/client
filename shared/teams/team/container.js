// @flow
import {connect} from 'react-redux'
import {compose, lifecycle} from 'recompose'
import {HeaderHoc} from '../../common-adapters'
import Team from '.'

import type {TypedState} from '../../constants/reducer'
import type {Teamname} from '../../constants/teams'

type StateProps = {
  name: Teamname,
}

const mapStateToProps = (state: TypedState, {routeProps}): StateProps => ({
  name: routeProps.teamname,
})

type DispatchProps = {
  _loadTeam: () => void,
  onBack: () => void,
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}): DispatchProps => ({
  _loadTeam: () => console.log('TODO'),
  onBack: () => dispatch(navigateUp()),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentDidMount: function() {
      this.props._loadTeam()
    },
  }),
  HeaderHoc
)(Team)
