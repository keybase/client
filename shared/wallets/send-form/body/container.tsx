import {SendBody as SendBodyComponent, RequestBody as RequestBodyComponent} from '.'
import {namedConnect} from '../../../util/container'
import * as Constants from '../../../constants/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'

type OwnProps = {}

const mapStateToProps = state => ({
  _failed: !!state.wallets.sentPaymentError,
  banners: state.wallets.building.isRequest
    ? state.wallets.builtRequest.builtBanners
    : state.wallets.builtPayment.builtBanners,
})

const mapDispatchToProps = dispatch => ({
  _onReviewPayments: () => dispatch(WalletsGen.createExitFailedPayment()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  banners: (stateProps.banners || []).map(banner => ({
    bannerBackground: Constants.bannerLevelToBackground(banner.level),
    bannerText: banner.message,
  })),
  onReviewPayments: stateProps._failed ? dispatchProps._onReviewPayments : null,
})

export const SendBody = namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ConnectedSendBody')(
  SendBodyComponent
)

export const RequestBody = namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedRequestBody'
)(RequestBodyComponent)
