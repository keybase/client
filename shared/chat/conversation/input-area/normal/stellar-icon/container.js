// @flow
import * as Container from '../../../../../util/container'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as WalletConstants from '../../../../../constants/wallets'
import _StellarIcon from '.'

const mapStateToProps = state => ({
  isNew: true,
})

const mapDispatchToProps = dispatch => ({
  onClick: () =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [WalletConstants.sendReceiveFormRouteKey]})),
})

const StellarIcon = Container.connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({
  ...o,
  ...s,
  ...d,
}))(_StellarIcon)

export default StellarIcon
