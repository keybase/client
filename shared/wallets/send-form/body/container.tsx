import {
  SendBody as SendBodyComponent,
  SendBodyAdvanced as SendBodyAdvancedComponent,
  RequestBody as RequestBodyComponent,
} from '.'
import {namedConnect} from '../../../util/container'
import * as Constants from '../../../constants/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

type OwnProps = {}

const mapStateToProps = state => ({
  _failed: !!state.wallets.sentPaymentError,
  _building: state.wallets.building,
  banners: state.wallets.building.isRequest
    ? state.wallets.builtRequest.builtBanners
    : state.wallets.builtPayment.builtBanners,
})

const mapDispatchToProps = dispatch => ({
  _onReviewPayments: () => dispatch(WalletsGen.createExitFailedPayment()),
  onGoAdvanced: (recipient, recipientType, senderAccountID) => {
    dispatch(WalletsGen.createSetBuildingAdvancedRecipient({recipient}))
    dispatch(WalletsGen.createSetBuildingAdvancedRecipientType({recipientType}))
    dispatch(WalletsGen.createSetBuildingAdvancedSenderAccountID({senderAccountID}))
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {isAdvanced: true}, selected: 'sendReceiveForm'}]})
    )
  },
})

const mergeProps = (stateProps, dispatchProps) => ({
  banners: (stateProps.banners || []).map(banner => ({
    bannerBackground: Constants.bannerLevelToBackground(banner.level),
    bannerText: banner.message,
  })),
  onGoAdvanced: () =>
    dispatchProps.onGoAdvanced(
      stateProps._building.to,
      stateProps._building.recipientType,
      stateProps._building.from
    ),
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

export const SendBodyAdvanced = namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedSendBodyAdvanced'
)(SendBodyAdvancedComponent)
