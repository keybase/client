import Qualify from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/wallets'
import * as Container from '../../../util/container'
import * as Platform from '../../../constants/platform'

type OwnProps = {
  shouldShowSystemButtons: boolean
}

const mapStateToProps = (state: Container.TypedState) => {
  console.warn('airdrop container')
  return {
    headerBody:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam in tristique dui. Sed nec neque sit amet magna porta ullamcorper. Aenean et diam eu ante finibus scelerisque.', //state.wallets.airdropDetails.details.header.body,
    show: true, // Constants.getShowAirdropBanner(state)
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onCancel: () => dispatch(WalletsGen.createHideAirdropBanner()),
  onCheckQualify: () => dispatch(RouteTreeGen.createNavigateTo({path: [...Constants.walletPath, 'airdrop']})),
})

export default Container.connect(mapStateToProps, mapDispatchToProps, (s, d, o: OwnProps) => {
  console.warn('in merge', o)
  return {
    ...s,
    ...d,
    ...o,
    oneLine: Platform.isMac,
  }
})(Qualify)
