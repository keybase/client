import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'
import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import ConfirmSend from '.'
import Participants from './participants/container'
import type * as Types from '../../constants/types/wallets'

export default () => {
  const build = Container.useSelector(state => state.wallets.building)
  const _built = Container.useSelector(state => state.wallets.builtPayment)
  const waitingKey = Constants.sendPaymentWaitingKey
  const _waiting = Container.useAnyWaiting(waitingKey)
  const _sentPaymentError = Container.useSelector(state => state.wallets.sentPaymentError)
  const displayAmountFiat = _built.displayAmountFiat
  const displayAmountXLM = _built.displayAmountXLM
  const encryptedNote = build.secretNote.stringValue()
  const publicMemo = _built.publicMemoOverride.stringValue() || build.publicMemo.stringValue()
  const readyToSend = _built.readyToSend
  const sendingIntentionXLM = _built.sendingIntentionXLM
  const to = build.to

  const dispatch = Container.useDispatch()
  const _onReviewProofs = (username: string) => {
    Container.isMobile
      ? dispatch(ProfileGen.createShowUserProfile({username}))
      : dispatch(Tracker2Gen.createShowUser({asTracker: true, username}))
  }
  const onAbandonPayment = () => {
    dispatch(WalletsGen.createAbandonPayment())
  }
  let onBack = () => {
    dispatch(WalletsGen.createClearErrors())
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(WalletsGen.createBuildPayment())
  }
  const onExitFailed = () => {
    dispatch(WalletsGen.createExitFailedPayment())
  }
  const onSendClick = () => {
    dispatch(WalletsGen.createSendPayment())
  }

  const exchangeRateChanged =
    _sentPaymentError && _sentPaymentError.toLowerCase().includes(Constants.exchangeRateErrorText)
  const recipientRequiresAMemo =
    _sentPaymentError && _sentPaymentError.toLowerCase().includes(Constants.recipientRequiresAMemoErrorText)
  const banners: Array<Types.Banner> = [
    ...(_sentPaymentError
      ? [
          {
            action: exchangeRateChanged ? undefined : onExitFailed,
            actionText: recipientRequiresAMemo ? 'Go back' : 'Review payments',
            bannerBackground: 'HighRisk',
            bannerText: recipientRequiresAMemo ? 'This recipient requires a memo.' : _sentPaymentError,
            sendFailed: true,
          } as const,
        ]
      : []),
    ...(_built.reviewBanners?.map(
      (banner): Types.Banner => ({
        action: banner.proofsChanged ? () => _onReviewProofs(to) : undefined,
        bannerBackground: Constants.bannerLevelToBackground(banner.level),
        bannerText: banner.message,
        reviewProofs: banner.proofsChanged,
      })
    ) ?? []),
  ]

  if (_waiting) {
    // Not allowed to go anywhere while waiting for send
    onBack = () => {}
  } else if (_sentPaymentError && !exchangeRateChanged) {
    // Close out of everything if failed
    onBack = onAbandonPayment
  }
  const props = {
    banners,
    displayAmountFiat: displayAmountFiat,
    displayAmountXLM: displayAmountXLM,
    encryptedNote: encryptedNote,
    onBack,
    onClose: onBack,
    onSendClick: onSendClick,
    participantsComp: Participants,
    publicMemo: publicMemo,
    readyToSend: readyToSend,
    sendFailed: !!_sentPaymentError,
    sendingIntentionXLM: sendingIntentionXLM,
    showCancelInsteadOfBackOnMobile: false,
    waitingKey: waitingKey,
  }
  return <ConfirmSend {...props} />
}
