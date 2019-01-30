// @flow
import Qualify from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/wallets'
import {connect} from '../../../util/container'
import flags from '../../../util/feature-flags'

type OwnProps = {||}

const mapStateToProps = state => ({
  show: true, // flags.airdrop && state.wallets.airdropState === 'noResponse',
})

const mapDispatchToProps = dispatch => ({
  onCancel: () => dispatch(WalletsGen.createChangeAirdrop({accept: false})),
  onCheckQualify: () => dispatch(RouteTreeGen.createNavigateTo({path: [...Constants.walletPath, 'airdrop']})),
})

const mergeProps = (s, d, o) => ({
  ...s,
  ...d,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Qualify)
