// @flow
import * as Creators from '../../actions/git/creators'
import DeleteRepo from '.'
import {compose} from 'recompose'
import {connect} from 'react-redux'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  name: routeProps.name,
  teamname: routeProps.teamname,
})

const mapDispatchToProps = (dispatch: any, {navigateAppend, navigateUp, routeProps}) => ({
  onClose: () => dispatch(navigateUp()),
  onDelete: (notifyTeam: boolean) =>
    dispatch(Creators.deleteRepo(routeProps.teamname, routeProps.name, notifyTeam)),
})

export default compose(connect(mapStateToProps, mapDispatchToProps))(DeleteRepo)
