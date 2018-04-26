// @flow
import Wallets from '.'
import * as WalletsGen from '../actions/wallets-gen'
import {connect, type TypedState, type Dispatch} from '../util/container'

const mapStateToProps = (state: TypedState) => {
  const {hello} = state.wallets
  return {hello}
}

const mapDispatchToProps = (dispatch: Dispatch, {routeState, setRouteState, navigateUp}) => ({
  refresh: () => dispatch(WalletsGen.createWalletsRefresh()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  hello: stateProps.hello,
  refresh: dispatchProps.refresh,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Wallets)
