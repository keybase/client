// @flow
import {navigateAppend} from '../../../../actions/route-tree'
import {connect} from '../../../../util/container'
import Add from '.'

type OwnProps = {teamname: string}

const mapStateToProps = () => ({})

const mapDispatchToProps = (dispatch, {teamname}: OwnProps) => ({
  onCreateSubteam: () =>
    dispatch(navigateAppend([{props: {makeSubteam: true, name: teamname}, selected: 'showNewTeamDialog'}])),
})

const mergeProps = (stateProps, dispatchProps) => ({
  onCreateSubteam: dispatchProps.onCreateSubteam,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Add)
