import Qualify from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'
import * as Container from '../../../util/container'

type OwnProps = {
  showSystemButtons: boolean
}

const mapStateToProps = (state: Container.TypedState) => ({
  headerBody: state.wallets.airdropDetails.details.header.body,
  show: Constants.getShowAirdropBanner(state),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onCancel: () => dispatch(WalletsGen.createHideAirdropBanner()),
  onCheckQualify: () => {
    // Switch to the wallet tab to make sure the disclaimer appears.
    dispatch(RouteTreeGen.createSwitchTab({tab: Constants.rootWalletTab}))
    dispatch(
      WalletsGen.createSelectAccount({accountID: Types.airdropAccountID, reason: 'user-selected', show: true})
    )
  },
})

export default Container.connect(mapStateToProps, mapDispatchToProps, (s, d, o: OwnProps) => ({
  ...s,
  ...d,
  ...o,
}))(Qualify)
