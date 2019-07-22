import ConfirmSend from '.'
import * as Constants from '../../constants/wallets'
import * as ProfileGen from '../../actions/profile-gen'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import Participants from './participants/container'
import {anyWaiting} from '../../constants/waiting'
import {namedConnect, isMobile, RouteProps} from '../../util/container'

type OwnProps = RouteProps

const mapStateToProps = state => {
  const build = state.wallets.building
  const _built = state.wallets.builtPayment
  const waitingKey = Constants.sendPaymentWaitingKey
  const _waiting = anyWaiting(state, waitingKey)
  return {
    _built,
    _sentPaymentError: state.wallets.sentPaymentError,
    _waiting,
    displayAmountFiat: _built.displayAmountFiat,
    displayAmountXLM: _built.displayAmountXLM,
    encryptedNote: build.secretNote.stringValue(),
    publicMemo: build.publicMemo.stringValue(),
    readyToSend: _built.readyToSend,
    sendingIntentionXLM: _built.sendingIntentionXLM,
    to: build.to,
    waitingKey,
  }
}

const mapDispatchToProps = dispatch => ({
  _onReviewProofs: (username: string) =>
    isMobile
      ? dispatch(ProfileGen.createShowUserProfile({username}))
      : dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
  onAbandonPayment: () => dispatch(WalletsGen.createAbandonPayment()),
  onBack: () => {
    dispatch(WalletsGen.createClearErrors())
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(WalletsGen.createBuildPayment())
  },
  onExitFailed: () => dispatch(WalletsGen.createExitFailedPayment()),
  onSendClick: () => dispatch(WalletsGen.createSendPayment()),
})

export default namedConnect(
  mapStateToProps,
  mapDispatchToProps,
    (stateProps, dispatchProps, _: OwnProps) => {
    const {_built, _sentPaymentError} = stateProps
    const exchangeRateChanged = _sentPaymentError && _sentPaymentError.toLowerCase().includes('exchange rate')
    const banners = (_sentPaymentError
      ? [
          {
            action: exchangeRateChanged ? undefined : dispatchProps.onExitFailed,
            bannerBackground: 'HighRisk' as 'HighRisk',
            bannerText: _sentPaymentError,
            sendFailed: true,
          },
        ]
      : []
    ).concat(
      (_built.reviewBanners || []).map(banner => ({
        action: banner.proofsChanged ? () => dispatchProps._onReviewProofs(stateProps.to) : undefined,
        bannerBackground: Constants.bannerLevelToBackground(banner.level),
        bannerText: banner.message,
        reviewProofs: banner.proofsChanged,
      }))
    )

    let onBack = dispatchProps.onBack
    if (stateProps._waiting) {
      // Not allowed to go anywhere while waiting for send
      onBack = () => {}
    } else if (stateProps._sentPaymentError && !exchangeRateChanged) {
      // Close out of everything if failed
      onBack = dispatchProps.onAbandonPayment
    }
    return {
      banners,
      displayAmountFiat: stateProps.displayAmountFiat,
      displayAmountXLM: stateProps.displayAmountXLM,
      encryptedNote: stateProps.encryptedNote,
      onBack,
      onClose: onBack,
      onSendClick: dispatchProps.onSendClick,
      participantsComp: Participants,
      publicMemo: stateProps.publicMemo,
      readyToSend: stateProps.readyToSend,
      sendFailed: !!_sentPaymentError,
      sendingIntentionXLM: stateProps.sendingIntentionXLM,
      showCancelInsteadOfBackOnMobile: false,
      waitingKey: stateProps.waitingKey,
    }
  },
  'ConfirmSend'
)(ConfirmSend)
