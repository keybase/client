// @flow
import Wallets from '.'
import * as WalletsGen from '../actions/wallets-gen'
import {compose, connect, lifecycle, type TypedState, type Dispatch, isMobile} from '../util/container'
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

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount() {
      this.props.refresh()
    },
  })
)(isMobile ? HeaderHoc(Wallets) : Wallets)