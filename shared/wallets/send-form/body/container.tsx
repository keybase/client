import {SendBody as SendBodyComponent, RequestBody as RequestBodyComponent} from '.'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

const useConnect = () => {
  const _accountMap = Container.useSelector(state => state.wallets.accountMap)
  const _building = Container.useSelector(state => state.wallets.building)
  const _failed = Container.useSelector(state => !!state.wallets.sentPaymentError)
  const banners = Container.useSelector(state =>
    state.wallets.building.isRequest
      ? state.wallets.builtRequest.builtBanners
      : state.wallets.builtPayment.builtBanners
  )

  const _onGoAdvanced = (recipient, recipientType, senderAccountID) => {
    dispatch(WalletsGen.createClearBuildingAdvanced())
    dispatch(WalletsGen.createSetBuildingAdvancedRecipient({recipient}))
    dispatch(WalletsGen.createSetBuildingAdvancedRecipientType({recipientType}))
    dispatch(WalletsGen.createSetBuildingAdvancedSenderAccountID({senderAccountID}))
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {isAdvanced: true}, selected: 'sendReceiveForm'}]})
    )
  }
  const _onReviewPayments = () => {
    dispatch(WalletsGen.createExitFailedPayment())
  }

  const dispatch = Container.useDispatch()
  const props = {
    banners: (banners || []).map(
      (banner): Types.Banner => ({
        action: () =>
          _onGoAdvanced(
            _building.to,
            _building.recipientType,
            // This can happen when sending from chat. The normal payment path
            // goes through buildPayment to get the sender AccountID so we don't
            // have it here.
            _building.from === Types.noAccountID
              ? ([..._accountMap.values()].find(account => account.isDefault) ?? Constants.unknownAccount)
                  .accountID
              : _building.from
          ),
        bannerBackground: Constants.bannerLevelToBackground(banner.level),
        bannerText: banner.message,
        offerAdvancedSendForm: banner.offerAdvancedSendForm,
      })
    ),
    onReviewPayments: _failed ? _onReviewPayments : null,
  }
  return props
}

export const SendBody = () => {
  const props = useConnect()
  return <SendBodyComponent {...props} />
}

export const RequestBody = () => {
  const props = useConnect()
  return <RequestBodyComponent {...props} />
}
