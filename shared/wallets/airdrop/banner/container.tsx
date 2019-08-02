import Qualify from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/wallets'
import * as Tabs from '../../../constants/tabs'
import * as Container from '../../../util/container'
import {isMobile} from '../../../constants/platform'

type OwnProps = {
  showSystemButtons: boolean
}

const mapStateToProps = (state: Container.TypedState) => ({
  headerBody: state.wallets.airdropDetails.details.header.body,
  show: Constants.getShowAirdropBanner(state),
  acceptedDisclaimer: Constants.getAcceptedDisclaimer(state),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onCancel: () => dispatch(WalletsGen.createHideAirdropBanner()),
  _onCheckQualify: (acceptedDisclaimer: boolean) => {
    if (acceptedDisclaimer) {
      dispatch(RouteTreeGen.createNavigateAppend({path: [...Constants.rootWalletPath, 'airdrop']}))
    } else {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            ...Constants.rootWalletPath,
            {props: {onboardingReason: 'airdrop'}, selected: 'walletOnboarding'},
          ],
        })
      )
    }
  },
})

export default Container.connect(mapStateToProps, mapDispatchToProps, (s, d, o: OwnProps) => ({
  ...s,
  ...d,
  ...o,
  onCheckQualify: () => d._onCheckQualify(s.acceptedDisclaimer),
}))(Qualify)
