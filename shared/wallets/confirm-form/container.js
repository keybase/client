// @flow
import ConfirmSend from '.'
import * as Constants from '../../constants/wallets'
import * as ProfileGen from '../../actions/profile-gen'
import * as TrackerGen from '../../actions/tracker-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import {connect, isMobile, type RouteProps} from '../../util/container'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => {
  const build = state.wallets.building
  const built = state.wallets.builtPayment
  const banners = (state.wallets.sentPaymentError
    ? [
        {
          bannerBackground: 'HighRisk',
          bannerText: state.wallets.sentPaymentError,
          sendFailed: true,
        },
      ]
    : []
  ).concat(
    (built.reviewBanners || []).map(banner => ({
      bannerBackground: Constants.bannerLevelToBackground(banner.level),
      bannerText: banner.message,
      reviewProofs: banner.proofsChanged,
    }))
  )
  return {
    banners,
    displayAmountFiat: built.displayAmountFiat,
    displayAmountXLM: built.displayAmountXLM,
    encryptedNote: build.secretNote.stringValue(),
    publicMemo: build.publicMemo.stringValue(),
    readyToSend: built.readyToSend,
    sendFailed: !!state.wallets.sentPaymentError,
    sendingIntentionXLM: built.sendingIntentionXLM,
    to: build.to,
    waitingKey: Constants.sendPaymentWaitingKey,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}: OwnProps) => ({
  _onReviewProofs: (username: string) =>
    isMobile
      ? dispatch(ProfileGen.createShowUserProfile({username}))
      : dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username})),
  onAbandonPayment: () => dispatch(WalletsGen.createAbandonPayment()),
  onBack: () => {
    dispatch(WalletsGen.createClearErrors())
    dispatch(navigateUp())
  },
  onClose: () => {
    dispatch(WalletsGen.createClearErrors())
    dispatch(navigateUp())
  },
  onExitFailed: () => dispatch(WalletsGen.createExitFailedPayment()),
  onSendClick: () => dispatch(WalletsGen.createSendPayment()),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps) => ({
    banners: stateProps.banners.map(b => {
      if (b.reviewProofs) {
        return {...b, action: () => dispatchProps._onReviewProofs(stateProps.to)}
      } else if (b.sendFailed) {
        return {...b, action: dispatchProps.onExitFailed}
      }
      return b
    }),
    displayAmountFiat: stateProps.displayAmountFiat,
    displayAmountXLM: stateProps.displayAmountXLM,
    encryptedNote: stateProps.encryptedNote,
    // Always close send form completely if send failed
    onBack: stateProps.sendFailed ? dispatchProps.onAbandonPayment : dispatchProps.onBack,
    onClose: stateProps.sendFailed ? dispatchProps.onAbandonPayment : dispatchProps.onClose,
    onSendClick: dispatchProps.onSendClick,
    publicMemo: stateProps.publicMemo,
    readyToSend: stateProps.readyToSend,
    sendFailed: stateProps.sendFailed,
    sendingIntentionXLM: stateProps.sendingIntentionXLM,
    waitingKey: stateProps.waitingKey,
  })
)(ConfirmSend)
