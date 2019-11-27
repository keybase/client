import {SendBody as SendBodyComponent, RequestBody as RequestBodyComponent} from '.'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

type OwnProps = {}

const mapStateToProps = (state: Container.TypedState) => ({
  _accountMap: state.wallets.accountMap,
  _building: state.wallets.building,
  _failed: !!state.wallets.sentPaymentError,
  banners: state.wallets.building.isRequest
    ? state.wallets.builtRequest.builtBanners
    : state.wallets.builtPayment.builtBanners,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onGoAdvanced: (recipient, recipientType, senderAccountID) => {
    dispatch(WalletsGen.createClearBuildingAdvanced())
    dispatch(WalletsGen.createSetBuildingAdvancedRecipient({recipient}))
    dispatch(WalletsGen.createSetBuildingAdvancedRecipientType({recipientType}))
    dispatch(WalletsGen.createSetBuildingAdvancedSenderAccountID({senderAccountID}))
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {isAdvanced: true}, selected: 'sendReceiveForm'}]})
    )
  },
  _onReviewPayments: () => dispatch(WalletsGen.createExitFailedPayment()),
})

const mergeProps = (
  stateProps: ReturnType<typeof mapStateToProps>,
  dispatchProps: ReturnType<typeof mapDispatchToProps>,
  _: OwnProps
) => ({
  banners: (stateProps.banners || []).map(
    (banner): Types.Banner => ({
      action: () =>
        dispatchProps._onGoAdvanced(
          stateProps._building.to,
          stateProps._building.recipientType,
          // This can happen when sending from chat. The normal payment path
          // goes through buildPayment to get the sender AccountID so we don't
          // have it here.
          stateProps._building.from === Types.noAccountID
            ? (
                [...stateProps._accountMap.values()].find(account => account.isDefault) ??
                Constants.unknownAccount
              ).accountID
            : stateProps._building.from
        ),
      bannerBackground: Constants.bannerLevelToBackground(banner.level),
      bannerText: banner.message,
      offerAdvancedSendForm: banner.offerAdvancedSendForm,
    })
  ),
  onReviewPayments: stateProps._failed ? dispatchProps._onReviewPayments : null,
})

export const SendBody = Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedSendBody'
)(SendBodyComponent)

export const RequestBody = Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedRequestBody'
)(RequestBodyComponent)
