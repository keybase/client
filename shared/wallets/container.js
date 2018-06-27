// @flow
import Wallets from '.'
import * as WalletsGen from '../actions/wallets-gen'
import {compose, connect, lifecycle, type TypedState, type Dispatch} from '../util/container'
import {HeaderOnMobile} from '../common-adapters'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  refresh: () => dispatch(WalletsGen.createLoadAccounts()),
})

const mergeProps = (stateProps, dispatchProps) => ({
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
)(HeaderOnMobile(Wallets))
