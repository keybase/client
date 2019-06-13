import Qualify from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/wallets'
import * as Container from '../../../util/container'
import flags from '../../../util/feature-flags'

type OwnProps = {}

const mapStateToProps = (state: Container.TypedState) => ({
  headerBody: state.wallets.airdropDetails.header.body,
  show:
    flags.airdrop &&
    state.wallets.airdropShowBanner &&
    (state.wallets.airdropState === 'qualified' || state.wallets.airdropState === 'unqualified'),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onCancel: () => dispatch(WalletsGen.createHideAirdropBanner()),
  onCheckQualify: () => dispatch(RouteTreeGen.createNavigateTo({path: [...Constants.walletPath, 'airdrop']})),
})

export default Container.connect(mapStateToProps, mapDispatchToProps, (s, d, _: OwnProps) => ({...s, ...d}))(
  Qualify
)
