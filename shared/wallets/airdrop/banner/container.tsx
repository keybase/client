import Qualify from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/wallets'
import {connect} from '../../../util/container'
import flags from '../../../util/feature-flags'

type OwnProps = {}

const mapStateToProps = state => ({
  headerBody: state.wallets.airdropDetails.header.body,
  show:
    flags.airdrop &&
    state.wallets.airdropShowBanner &&
    (state.wallets.airdropState === 'qualified' || state.wallets.airdropState === 'unqualified'),
})

const mapDispatchToProps = dispatch => ({
  onCancel: () => dispatch(WalletsGen.createHideAirdropBanner()),
  onCheckQualify: () => dispatch(RouteTreeGen.createNavigateTo({path: [...Constants.walletPath, 'airdrop']})),
})

const mergeProps = (s, d, o) => ({
  ...s,
  ...d,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Qualify)
