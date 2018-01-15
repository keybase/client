// @flow
import * as RouteTree from '../../../../actions/route-tree'
import SystemSimpleToComplex from '.'
import {connect, type TypedState, type Dispatch} from '../../../../util/container'

const mapStateToProps = (state: TypedState) => ({
  you: state.config.username || '',
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onManageChannels: (teamname: string) =>
    dispatch(RouteTree.navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  message: ownProps.message,
  onManageChannels: () => dispatchProps._onManageChannels(ownProps.message.team),
  you: stateProps.you,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(SystemSimpleToComplex)
