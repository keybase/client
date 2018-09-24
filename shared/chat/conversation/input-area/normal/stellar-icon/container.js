// @flow
import * as Container from '../../../../../util/container'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as WalletConstants from '../../../../../constants/wallets'
import _StellarIcon from '.'

const mapStateToProps = state => ({
  isNew: state.chat2.isWalletsNew,
})

const mapDispatchToProps = dispatch => ({
  onClick: () => dispatch(Chat2Gen.createHandleSeeingWallets()),
  // dispatch(RouteTreeGen.createNavigateAppend({path: [WalletConstants.sendReceiveFormRouteKey]})),
})

const StellarIcon = Container.connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({
  ...o,
  ...s,
  ...d,
}))(_StellarIcon)

export default StellarIcon
