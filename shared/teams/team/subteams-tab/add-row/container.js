// @flow
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {connect} from '../../../../util/container'
import Add from '.'

type OwnProps = {teamname: string}

const mapStateToProps = () => ({})

const mapDispatchToProps = (dispatch, {teamname}: OwnProps) => ({
  onCreateSubteam: () =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {makeSubteam: true, name: teamname}, selected: 'showNewTeamDialog'}]})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  onCreateSubteam: dispatchProps.onCreateSubteam,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Add)
