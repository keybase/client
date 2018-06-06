// @flow
import Wallets from '.'
import * as WalletsGen from '../actions/wallets-gen'
import {connect, type TypedState, type Dispatch, isMobile} from '../util/container'
import {HeaderHoc} from '../common-adapters'

const mapStateToProps = (state: TypedState) => {
  const {hello} = state.wallets
  return {hello}
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  refresh: () => dispatch(WalletsGen.createWalletsRefresh()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  hello: stateProps.hello,
  onBack: dispatchProps.onBack,
  refresh: dispatchProps.refresh,
  title: 'Wallets',
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(isMobile ? HeaderHoc(Wallets) : Wallets)
